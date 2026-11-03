// Minimal hand-written FHIR R4 types for the resources this app touches.
// ponytail: hand-written subset; swap for @types/fhir if the surface grows.

export interface Coding {
  system?: string;
  code?: string;
  display?: string;
}

export interface Extension {
  url: string;
  valueDecimal?: number;
  valueString?: string;
  valueCoding?: Coding;
  valueCodeableConcept?: { coding?: Coding[]; text?: string };
}

export interface Reference {
  reference?: string;
  display?: string;
}

export interface QuestionnaireItem {
  linkId: string;
  text?: string;
  type: string;
  required?: boolean;
  code?: Coding[];
  extension?: Extension[];
  answerOption?: { valueCoding: Coding; extension?: Extension[] }[];
  item?: QuestionnaireItem[];
}

export interface Questionnaire {
  resourceType: "Questionnaire";
  id: string;
  url: string;
  title: string;
  status: string;
  copyright?: string;
  code?: Coding[];
  item: QuestionnaireItem[];
}

export interface QuestionnaireResponseItem {
  linkId: string;
  text?: string;
  answer?: { valueCoding?: Coding; valueDecimal?: number }[];
}

export interface QuestionnaireResponse {
  resourceType: "QuestionnaireResponse";
  id?: string;
  questionnaire: string;
  status: "completed";
  subject: Reference;
  authored: string;
  item: QuestionnaireResponseItem[];
}

export interface Patient {
  resourceType: "Patient";
  id: string;
  identifier: { system: string; value: string }[];
  name: { use?: string; family: string; given: string[] }[];
  birthDate?: string;
  meta?: { tag?: Coding[] };
}

export interface Observation {
  resourceType: "Observation";
  id: string;
  status: "final";
  category: { coding: Coding[] }[];
  code: { coding: Coding[]; text?: string };
  subject: Reference;
  effectiveDateTime: string;
  valueQuantity?: { value: number; unit: string; system: string; code: string };
  derivedFrom?: Reference[];
  interpretation?: { text: string }[];
}

export type Resource = Patient | QuestionnaireResponse | Observation;

export interface Bundle {
  resourceType: "Bundle";
  type: "searchset" | "collection" | "transaction";
  timestamp?: string;
  total?: number;
  entry: { fullUrl?: string; resource: Resource; search?: { mode: "match" | "include" } }[];
}
