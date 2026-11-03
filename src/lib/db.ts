import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS patients (
  id          TEXT PRIMARY KEY,
  demo_id     TEXT NOT NULL UNIQUE,
  given       TEXT NOT NULL,
  family      TEXT NOT NULL,
  birth_date  TEXT,
  nhs_number  TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('patient', 'clinician')),
  display_name  TEXT NOT NULL,
  patient_id    TEXT REFERENCES patients(id),
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until  TEXT,
  CHECK ((role = 'patient') = (patient_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS responses (
  id            TEXT PRIMARY KEY,
  patient_id    TEXT NOT NULL REFERENCES patients(id),
  instrument    TEXT NOT NULL CHECK (instrument IN ('phq-9', 'gad-7')),
  authored      TEXT NOT NULL,
  total         INTEGER NOT NULL,
  band          TEXT NOT NULL,
  resource_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS responses_patient ON responses(patient_id, authored);

CREATE TABLE IF NOT EXISTS alerts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  response_id TEXT NOT NULL REFERENCES responses(id),
  patient_id  TEXT NOT NULL REFERENCES patients(id),
  rule        TEXT NOT NULL,
  severity    TEXT NOT NULL CHECK (severity IN ('urgent', 'high')),
  message     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  at            TEXT NOT NULL,
  actor_id      TEXT,
  actor_role    TEXT,
  action        TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   TEXT,
  outcome       TEXT NOT NULL CHECK (outcome IN ('success', 'denied', 'failure'))
);

-- Audit log is append-only: the database itself refuses edits and deletes (H-06, T-R1).
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_log
  BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_log
  BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
`;

export type DB = Database.Database;

export function openDb(file: string): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}

function defaultPath(): string {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;
  // Serverless hosts only allow writes to /tmp; the demo there is ephemeral by design.
  if (process.env.VERCEL) return "/tmp/rehab-proms.db";
  return path.join(process.cwd(), "data", "rehab-proms.db");
}

const globalForDb = globalThis as unknown as { __db?: DB };

export function getDb(): DB {
  if (!globalForDb.__db) {
    const db = openDb(defaultPath());
    globalForDb.__db = db;
    const empty = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n === 0;
    if (empty && (process.env.DEMO_AUTO_SEED === "1" || process.env.VERCEL)) {
      // Lazy import keeps seed code (and demo passwords) out of the normal request path.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./seed").seed(db);
    }
  }
  return globalForDb.__db;
}

/** Test helper: point the app at a fresh database. */
export function setDbForTests(db: DB) {
  globalForDb.__db = db;
}
