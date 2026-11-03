import phq9 from "@/questionnaires/phq-9.json";
import gad7 from "@/questionnaires/gad-7.json";
import type { Questionnaire, QuestionnaireItem } from "./types";

export type InstrumentId = "phq-9" | "gad-7";

export interface Instrument {
  id: InstrumentId;
  shortName: string;
  /** Standard instruction shown above the items (from the published instrument). */
  stem: string;
  topic: string;
  questionnaire: Questionnaire;
  /** linkId of the calculated total score item (not shown to the patient). */
  totalLinkId: string;
  /** LOINC code for the total score, used for the derived Observation. */
  totalLoinc: { code: string; display: string };
  maxScore: number;
  /** Severity bands, lower bound inclusive. Published cut-offs for each instrument. */
  bands: { min: number; label: string }[];
}

export const INSTRUMENTS: Record<InstrumentId, Instrument> = {
  "phq-9": {
    id: "phq-9",
    shortName: "PHQ-9",
    topic: "Mood",
    stem: "Over the last 2 weeks, how often have you been bothered by any of the following problems?",
    questionnaire: phq9 as Questionnaire,
    totalLinkId: "/44261-6",
    totalLoinc: { code: "44261-6", display: "Patient health questionnaire 9 item total score" },
    maxScore: 27,
    bands: [
      { min: 0, label: "Minimal" },
      { min: 5, label: "Mild" },
      { min: 10, label: "Moderate" },
      { min: 15, label: "Moderately severe" },
      { min: 20, label: "Severe" },
    ],
  },
  "gad-7": {
    id: "gad-7",
    shortName: "GAD-7",
    topic: "Worry and anxiety",
    stem: "Over the last 2 weeks, how often have you been bothered by the following problems?",
    questionnaire: gad7 as Questionnaire,
    totalLinkId: "/70274-6",
    totalLoinc: { code: "70274-6", display: "Generalized anxiety disorder 7 item total score" },
    maxScore: 21,
    bands: [
      { min: 0, label: "Minimal" },
      { min: 5, label: "Mild" },
      { min: 10, label: "Moderate" },
      { min: 15, label: "Severe" },
    ],
  },
};

export function getInstrument(id: string): Instrument | undefined {
  return Object.hasOwn(INSTRUMENTS, id) ? INSTRUMENTS[id as InstrumentId] : undefined;
}

/** Items the patient answers: choice items with answer options. */
export function answerableItems(q: Questionnaire): QuestionnaireItem[] {
  return q.item.filter((i) => i.type === "choice" && (i.answerOption?.length ?? 0) > 0);
}

/** Items that contribute to the total score (have an ordinalValue on every option). */
export function scoredItems(q: Questionnaire): QuestionnaireItem[] {
  return answerableItems(q).filter((i) => i.answerOption!.every((o) => ordinalOf(o) !== undefined));
}

export function ordinalOf(option: NonNullable<QuestionnaireItem["answerOption"]>[number]): number | undefined {
  const ext = option.extension?.find((e) => e.url === "http://hl7.org/fhir/StructureDefinition/ordinalValue");
  return typeof ext?.valueDecimal === "number" ? ext.valueDecimal : undefined;
}
