import { beforeEach, describe, expect, it } from "vitest";
import { LOCKOUT_MS, MAX_FAILED_LOGINS, SESSION_TTL_MS, attemptLogin, canAccessPatient, createSession, hashPassword, userForSession, verifyPassword } from "@/lib/auth-core";
import { audit, recentAudit } from "@/lib/audit";
import { type DB, openDb, setDbForTests } from "@/lib/db";
import { everythingBundle } from "@/lib/fhir/export";
import { INSTRUMENTS } from "@/lib/fhir/questionnaires";
import { alertsFor, caseload, getPatient, markAlertReviewed, responsesFor, submitResponse } from "@/lib/repo";
import { DEMO_PASSWORD, answersForTotal, seed } from "@/lib/seed";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  setDbForTests(db);
  seed();
});

describe("passwords and sessions", () => {
  it("hashes with a per-user salt and verifies", () => {
    const a = hashPassword("pw");
    expect(a).not.toBe(hashPassword("pw"));
    expect(verifyPassword("pw", a)).toBe(true);
    expect(verifyPassword("wrong", a)).toBe(false);
  });

  it("logs in with the right password, case-insensitive email", () => {
    const r = attemptLogin(db, " Clinician@Example.test ", DEMO_PASSWORD);
    expect(r.ok && r.user.role).toBe("clinician");
  });

  it(`locks the account after ${MAX_FAILED_LOGINS} failures, even for the right password`, () => {
    const now = Date.now();
    for (let i = 0; i < MAX_FAILED_LOGINS - 1; i++) expect(attemptLogin(db, "ada@example.test", "nope", now)).toEqual({ ok: false, reason: "invalid" });
    expect(attemptLogin(db, "ada@example.test", "nope", now)).toEqual({ ok: false, reason: "locked" });
    expect(attemptLogin(db, "ada@example.test", DEMO_PASSWORD, now)).toEqual({ ok: false, reason: "locked" });
    expect(attemptLogin(db, "ada@example.test", DEMO_PASSWORD, now + LOCKOUT_MS + 1).ok).toBe(true);
  });

  it("gives the same answer for unknown users as for wrong passwords", () => {
    expect(attemptLogin(db, "nobody@example.test", "x")).toEqual({ ok: false, reason: "invalid" });
  });

  it("expires sessions", () => {
    const now = Date.now();
    const s = createSession(db, "usr-ada", now);
    expect(userForSession(db, s.id, now)?.patient_id).toBe("pat-ada");
    expect(userForSession(db, s.id, now + SESSION_TTL_MS + 1)).toBeNull();
    expect(userForSession(db, "forged", now)).toBeNull();
  });
});

describe("authorisation", () => {
  it("lets patients see only their own record and clinicians see the caseload", () => {
    const ada = { id: "usr-ada", email: "", role: "patient" as const, display_name: "", patient_id: "pat-ada" };
    const clin = { id: "usr-clinician", email: "", role: "clinician" as const, display_name: "", patient_id: null };
    expect(canAccessPatient(ada, "pat-ada")).toBe(true);
    expect(canAccessPatient(ada, "pat-cara")).toBe(false);
    expect(canAccessPatient(clin, "pat-cara")).toBe(true);
  });

  it("enforces patient/role consistency in the schema", () => {
    expect(() =>
      db.prepare("INSERT INTO users (id, email, password_hash, role, display_name, patient_id) VALUES ('x','x@e.test','h','clinician','X','pat-ada')").run(),
    ).toThrow(/CHECK/);
  });
});

describe("submissions and alerts", () => {
  it("stores the response and its urgent alert together", () => {
    const { id, alerts } = submitResponse(INSTRUMENTS["phq-9"], "pat-dev", answersForTotal(INSTRUMENTS["phq-9"], 3, 1));
    expect(alerts.map((a) => a.rule)).toEqual(["PHQ9_ITEM9"]);
    expect(responsesFor("pat-dev").map((r) => r.id)).toEqual([id]);
    expect(alertsFor("pat-dev")).toHaveLength(1);
    expect(caseload()[0].id).toBe("pat-cara"); // existing urgent alert, then...
    expect(caseload()[1].id).toBe("pat-dev"); // ...new urgent alert ranks above patients without one
  });

  it("only reviews an alert once, and only for the right patient", () => {
    const alert = alertsFor("pat-cara").find((a) => !a.reviewed_at)!;
    expect(markAlertReviewed(alert.id, "pat-ada", "usr-clinician")).toBe(false);
    expect(markAlertReviewed(alert.id, "pat-cara", "usr-clinician")).toBe(true);
    expect(markAlertReviewed(alert.id, "pat-cara", "usr-clinician")).toBe(false);
  });
});

describe("audit log", () => {
  it("is append-only at the database level", () => {
    audit({ id: "usr-clinician", role: "clinician" }, "read", "Patient", "pat-ada");
    expect(recentAudit(1)[0]).toMatchObject({ action: "read", resource_id: "pat-ada", outcome: "success" });
    expect(() => db.prepare("UPDATE audit_log SET outcome = 'denied'").run()).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM audit_log").run()).toThrow(/append-only/);
  });
});

describe("FHIR export", () => {
  it("returns Patient, QuestionnaireResponses and LOINC-coded score Observations", () => {
    const bundle = everythingBundle(getPatient("pat-cara")!, responsesFor("pat-cara"), "http://localhost/api/fhir");
    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.entry[0].resource.resourceType).toBe("Patient");
    const types = bundle.entry.map((e) => e.resource.resourceType);
    expect(types.filter((t) => t === "QuestionnaireResponse")).toHaveLength(12);
    expect(types.filter((t) => t === "Observation")).toHaveLength(12);
    const obs = bundle.entry.map((e) => e.resource).find((r) => r.resourceType === "Observation" && r.code.coding[0].code === "44261-6");
    expect(obs).toMatchObject({ valueQuantity: { value: 9, code: "{score}" }, subject: { reference: "Patient/pat-cara" } });
    expect(JSON.stringify(bundle)).not.toMatch(/nhs-number/); // demo patients have none
  });
});
