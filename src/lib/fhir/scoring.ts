import { type Instrument, ordinalOf, scoredItems } from "./questionnaires";

/** Patient's answers keyed by Questionnaire item linkId, value is the chosen LOINC answer code. */
export type Answers = Record<string, string>;

export interface Alert {
  rule: "PHQ9_ITEM9" | "SEVERE_TOTAL";
  severity: "urgent" | "high";
  message: string;
}

export interface ScoreResult {
  total: number;
  band: string;
  alerts: Alert[];
}

/** PHQ-9 item 9: "Thoughts that you would be better off dead, or of hurting yourself". */
export const PHQ9_ITEM9_LINK_ID = "/44260-8";

/**
 * Alert thresholds. These are illustrative defaults taken from the published
 * severity bands. In a real deployment they must be agreed and signed off by the
 * Clinical Safety Officer (see docs/clinical-safety/hazard-log.md, H-01 and H-02).
 */
export const SEVERE_THRESHOLD: Record<Instrument["id"], number> = { "phq-9": 20, "gad-7": 15 };

export function bandFor(instrument: Instrument, total: number): string {
  let label = instrument.bands[0].label;
  for (const b of instrument.bands) if (total >= b.min) label = b.label;
  return label;
}

/**
 * Score a complete set of answers. Throws if any scored item is missing or has an
 * unknown code: a partial score must never be shown as if it were complete (H-03).
 */
export function score(instrument: Instrument, answers: Answers): ScoreResult {
  let total = 0;
  const ordinals: Record<string, number> = {};
  for (const item of scoredItems(instrument.questionnaire)) {
    const code = answers[item.linkId];
    const option = item.answerOption!.find((o) => o.valueCoding.code === code);
    if (!option) throw new Error(`Missing or invalid answer for ${item.linkId}`);
    const value = ordinalOf(option)!;
    ordinals[item.linkId] = value;
    total += value;
  }

  const alerts: Alert[] = [];
  if (instrument.id === "phq-9" && ordinals[PHQ9_ITEM9_LINK_ID] > 0) {
    alerts.push({
      rule: "PHQ9_ITEM9",
      severity: "urgent",
      message: "PHQ-9 item 9 (thoughts of self-harm) answered above 'Not at all'. Review today.",
    });
  }
  if (total >= SEVERE_THRESHOLD[instrument.id]) {
    alerts.push({
      rule: "SEVERE_TOTAL",
      severity: "high",
      message: `${instrument.shortName} total ${total} is in the ${bandFor(instrument, total).toLowerCase()} range.`,
    });
  }
  return { total, band: bandFor(instrument, total), alerts };
}
