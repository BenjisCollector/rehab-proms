import { INSTRUMENTS } from "./questionnaires";
import type { Bundle, Observation, Patient, QuestionnaireResponse } from "./types";
import type { PatientRow, ResponseRow } from "../repo";

export const DEMO_ID_SYSTEM = "https://github.com/BenjisCollector/rehab-proms/demo-id";

export function toFhirPatient(p: PatientRow): Patient {
  const identifier = [{ system: DEMO_ID_SYSTEM, value: p.demo_id }];
  if (p.nhs_number) identifier.push({ system: "https://fhir.nhs.uk/Id/nhs-number", value: p.nhs_number });
  return {
    resourceType: "Patient",
    id: p.id,
    identifier,
    name: [{ use: "official", family: p.family, given: [p.given] }],
    ...(p.birth_date ? { birthDate: p.birth_date } : {}),
    // HL7 v3 ActReason "HTEST": tells any receiving system this is test data, not a real person.
    meta: { tag: [{ system: "http://terminology.hl7.org/CodeSystem/v3-ActReason", code: "HTEST", display: "test health data" }] },
  };
}

/** Derived total-score Observation, linked back to the source QuestionnaireResponse. */
export function toScoreObservation(r: ResponseRow): Observation {
  const inst = INSTRUMENTS[r.instrument];
  return {
    resourceType: "Observation",
    id: `${r.id}-total`,
    status: "final",
    category: [
      { coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "survey", display: "Survey" }] },
    ],
    code: { coding: [{ system: "http://loinc.org", ...inst.totalLoinc }], text: `${inst.shortName} total score` },
    subject: { reference: `Patient/${r.patient_id}` },
    effectiveDateTime: r.authored,
    valueQuantity: { value: r.total, unit: "{score}", system: "http://unitsofmeasure.org", code: "{score}" },
    derivedFrom: [{ reference: `QuestionnaireResponse/${r.id}` }],
    interpretation: [{ text: r.band }],
  };
}

/** Patient/$everything-style searchset: the patient, every response and its derived score. */
export function everythingBundle(patient: PatientRow, responses: ResponseRow[], baseUrl: string): Bundle {
  const entries: Bundle["entry"] = [
    { fullUrl: `${baseUrl}/Patient/${patient.id}`, resource: toFhirPatient(patient), search: { mode: "match" } },
  ];
  for (const r of responses) {
    const qr = JSON.parse(r.resource_json) as QuestionnaireResponse;
    entries.push({ fullUrl: `${baseUrl}/QuestionnaireResponse/${r.id}`, resource: qr, search: { mode: "include" } });
    entries.push({ fullUrl: `${baseUrl}/Observation/${r.id}-total`, resource: toScoreObservation(r), search: { mode: "include" } });
  }
  return { resourceType: "Bundle", type: "searchset", timestamp: new Date().toISOString(), total: entries.length, entry: entries };
}
