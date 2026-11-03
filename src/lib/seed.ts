// Synthetic demo data only. Names are deliberately fake and no NHS numbers are used.
import { hashPassword } from "./auth-core";
import { getDb } from "./db";
import { INSTRUMENTS, type Instrument, scoredItems } from "./fhir/questionnaires";
import { PHQ9_ITEM9_LINK_ID, type Answers } from "./fhir/scoring";
import { submitResponse } from "./repo";

export const DEMO_PASSWORD = "demo-password-not-secret";

const PATIENTS = [
  { id: "pat-ada", demo_id: "DEMO-0001", given: "Ada", family: "Example", birth_date: "1970-01-01", phq: [18, 16, 13, 11, 9, 7], gad: [14, 12, 11, 9, 8, 6] },
  { id: "pat-ben", demo_id: "DEMO-0002", given: "Ben", family: "Sample", birth_date: "1980-01-01", phq: [7, 6, 8, 7, 6, 7], gad: [6, 5, 6, 6, 5, 5] },
  { id: "pat-cara", demo_id: "DEMO-0003", given: "Cara", family: "Placeholder", birth_date: "1990-01-01", phq: [9, 11, 14, 17, 19, 21], gad: [8, 10, 12, 13, 15, 16] },
  { id: "pat-dev", demo_id: "DEMO-0004", given: "Dev", family: "Synthetic", birth_date: "2000-01-01", phq: [], gad: [] },
];

/** Spread a target total across items (each 0-3), with item 9 fixed when given. */
export function answersForTotal(inst: Instrument, total: number, item9 = 0): Answers {
  const items = scoredItems(inst.questionnaire);
  const values: Record<string, number> = {};
  let remaining = total;
  if (inst.id === "phq-9") {
    values[PHQ9_ITEM9_LINK_ID] = item9;
    remaining -= item9;
  }
  const free = items.filter((i) => values[i.linkId] === undefined);
  for (const [n, item] of free.entries()) {
    const v = Math.min(3, Math.ceil(remaining / (free.length - n)));
    values[item.linkId] = v;
    remaining -= v;
  }
  const answers: Answers = {};
  for (const item of items) answers[item.linkId] = item.answerOption![values[item.linkId]].valueCoding.code!;
  return answers;
}

export function seed() {
  const db = getDb();
  const insertPatient = db.prepare(
    "INSERT INTO patients (id, demo_id, given, family, birth_date) VALUES (@id, @demo_id, @given, @family, @birth_date)",
  );
  const insertUser = db.prepare(
    "INSERT INTO users (id, email, password_hash, role, display_name, patient_id) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const hash = hashPassword(DEMO_PASSWORD);

  insertUser.run("usr-clinician", "clinician@example.test", hash, "clinician", "Demo Clinician", null);

  const start = Date.UTC(2026, 6, 1, 9, 0);
  const fortnight = 14 * 24 * 60 * 60 * 1000;
  for (const p of PATIENTS) {
    insertPatient.run(p);
    insertUser.run(`usr-${p.given.toLowerCase()}`, `${p.given.toLowerCase()}@example.test`, hash, "patient", `${p.given} ${p.family}`, p.id);
    p.phq.forEach((total, i) => {
      const at = new Date(start + i * fortnight).toISOString();
      const lastForCara = p.id === "pat-cara" && i === p.phq.length - 1;
      submitResponse(INSTRUMENTS["phq-9"], p.id, answersForTotal(INSTRUMENTS["phq-9"], total, lastForCara ? 1 : 0), at);
      submitResponse(INSTRUMENTS["gad-7"], p.id, answersForTotal(INSTRUMENTS["gad-7"], p.gad[i]), at);
    });
  }
  // Older alerts are shown as already reviewed so the demo has a realistic mix.
  db.prepare(
    `UPDATE alerts SET reviewed_at = created_at, reviewed_by = 'usr-clinician'
     WHERE created_at < (SELECT MAX(created_at) FROM alerts a2 WHERE a2.patient_id = alerts.patient_id)`,
  ).run();
}
