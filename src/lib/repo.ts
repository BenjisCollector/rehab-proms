import crypto from "node:crypto";
import { getDb } from "./db";
import type { Instrument, InstrumentId } from "./fhir/questionnaires";
import { buildQuestionnaireResponse, validateQuestionnaireResponse } from "./fhir/questionnaire-response";
import { type Answers, score } from "./fhir/scoring";
import type { QuestionnaireResponse } from "./fhir/types";

export interface PatientRow {
  id: string;
  demo_id: string;
  given: string;
  family: string;
  birth_date: string | null;
  nhs_number: string | null;
}

export interface ResponseRow {
  id: string;
  patient_id: string;
  instrument: InstrumentId;
  authored: string;
  total: number;
  band: string;
  resource_json: string;
}

export interface AlertRow {
  id: number;
  response_id: string;
  patient_id: string;
  rule: string;
  severity: "urgent" | "high";
  message: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export function getPatient(id: string): PatientRow | undefined {
  return getDb().prepare("SELECT * FROM patients WHERE id = ?").get(id) as PatientRow | undefined;
}

export function responsesFor(patientId: string): ResponseRow[] {
  return getDb()
    .prepare("SELECT * FROM responses WHERE patient_id = ? ORDER BY authored ASC")
    .all(patientId) as ResponseRow[];
}

export function alertsFor(patientId: string): AlertRow[] {
  return getDb()
    .prepare("SELECT * FROM alerts WHERE patient_id = ? ORDER BY reviewed_at IS NOT NULL, created_at DESC")
    .all(patientId) as AlertRow[];
}

export interface CaseloadRow extends PatientRow {
  open_urgent: number;
  open_high: number;
  last_phq9: number | null;
  last_gad7: number | null;
  last_authored: string | null;
}

/** Caseload ordered so the patients who most need review come first (H-04). */
export function caseload(): CaseloadRow[] {
  return getDb()
    .prepare(
      `SELECT p.*,
        (SELECT COUNT(*) FROM alerts a WHERE a.patient_id = p.id AND a.reviewed_at IS NULL AND a.severity = 'urgent') AS open_urgent,
        (SELECT COUNT(*) FROM alerts a WHERE a.patient_id = p.id AND a.reviewed_at IS NULL AND a.severity = 'high') AS open_high,
        (SELECT total FROM responses r WHERE r.patient_id = p.id AND r.instrument = 'phq-9' ORDER BY authored DESC LIMIT 1) AS last_phq9,
        (SELECT total FROM responses r WHERE r.patient_id = p.id AND r.instrument = 'gad-7' ORDER BY authored DESC LIMIT 1) AS last_gad7,
        (SELECT MAX(authored) FROM responses r WHERE r.patient_id = p.id) AS last_authored
       FROM patients p
       ORDER BY open_urgent DESC, open_high DESC, family ASC`,
    )
    .all() as CaseloadRow[];
}

/**
 * Score, build, validate and store one submission with its alerts, atomically.
 * Validation runs on the exact resource we persist, so nothing malformed is stored.
 */
export function submitResponse(
  instrument: Instrument,
  patientId: string,
  answers: Answers,
  authored = new Date().toISOString(),
): { response: QuestionnaireResponse; id: string; alerts: ReturnType<typeof score>["alerts"] } {
  const id = crypto.randomUUID();
  const qr = { ...buildQuestionnaireResponse(instrument, patientId, answers, authored), id };
  const problems = validateQuestionnaireResponse(instrument, qr);
  if (problems.length) throw new Error(`Invalid QuestionnaireResponse: ${problems.join("; ")}`);
  const result = score(instrument, answers);

  const db = getDb();
  db.transaction(() => {
    db.prepare(
      "INSERT INTO responses (id, patient_id, instrument, authored, total, band, resource_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(id, patientId, instrument.id, authored, result.total, result.band, JSON.stringify(qr));
    const insertAlert = db.prepare(
      "INSERT INTO alerts (response_id, patient_id, rule, severity, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    );
    for (const a of result.alerts) insertAlert.run(id, patientId, a.rule, a.severity, a.message, authored);
  })();

  return { response: qr, id, alerts: result.alerts };
}

/** Returns false if the alert does not exist, belongs to another patient, or was already reviewed. */
export function markAlertReviewed(alertId: number, patientId: string, clinicianId: string): boolean {
  const res = getDb()
    .prepare("UPDATE alerts SET reviewed_at = ?, reviewed_by = ? WHERE id = ? AND patient_id = ? AND reviewed_at IS NULL")
    .run(new Date().toISOString(), clinicianId, alertId, patientId);
  return res.changes === 1;
}
