import crypto from "node:crypto";
import type { DB } from "./db";

export type Role = "patient" | "clinician";

export interface User {
  id: string;
  email: string;
  role: Role;
  display_name: string;
  patient_id: string | null;
}

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEYLEN);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, "base64"), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// Used to keep response time similar when the email does not exist (no user enumeration).
const DUMMY_HASH = hashPassword(crypto.randomBytes(8).toString("hex"));

export type LoginResult = { ok: true; user: User } | { ok: false; reason: "invalid" | "locked" };

export function attemptLogin(db: DB, email: string, password: string, now = Date.now()): LoginResult {
  const row = db
    .prepare("SELECT id, email, role, display_name, patient_id, password_hash, failed_logins, locked_until FROM users WHERE email = ?")
    .get(email.trim().toLowerCase()) as (User & { password_hash: string; failed_logins: number; locked_until: string | null }) | undefined;

  if (!row) {
    verifyPassword(password, DUMMY_HASH);
    return { ok: false, reason: "invalid" };
  }
  if (row.locked_until && Date.parse(row.locked_until) > now) return { ok: false, reason: "locked" };

  if (!verifyPassword(password, row.password_hash)) {
    const failures = row.failed_logins + 1;
    const lockedUntil = failures >= MAX_FAILED_LOGINS ? new Date(now + LOCKOUT_MS).toISOString() : null;
    db.prepare("UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?").run(
      lockedUntil ? 0 : failures,
      lockedUntil,
      row.id,
    );
    return { ok: false, reason: lockedUntil ? "locked" : "invalid" };
  }

  db.prepare("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?").run(row.id);
  const { id, role, display_name, patient_id } = row;
  return { ok: true, user: { id, email: row.email, role, display_name, patient_id } };
}

export function createSession(db: DB, userId: string, now = Date.now()): { id: string; expires: Date } {
  const id = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(now + SESSION_TTL_MS);
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(id, userId, expires.toISOString());
  return { id, expires };
}

export function userForSession(db: DB, sessionId: string, now = Date.now()): User | null {
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.role, u.display_name, u.patient_id, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    )
    .get(sessionId) as (User & { expires_at: string }) | undefined;
  if (!row || Date.parse(row.expires_at) <= now) return null;
  const { id, email, role, display_name, patient_id } = row;
  return { id, email, role, display_name, patient_id };
}

export function deleteSession(db: DB, sessionId: string) {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

/**
 * Object-level authorisation, kept in one place so every route uses the same rule:
 * clinicians may access any patient on their caseload (single-team demo: all
 * patients), patients may only access their own record.
 */
export function canAccessPatient(user: User, patientId: string): boolean {
  if (user.role === "clinician") return true;
  return user.patient_id === patientId;
}
