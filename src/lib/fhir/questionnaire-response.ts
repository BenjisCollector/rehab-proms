import { z } from "zod";
import { type Instrument, answerableItems, scoredItems } from "./questionnaires";
import { type Answers, score } from "./scoring";
import type { QuestionnaireResponse } from "./types";

/**
 * Build a FHIR R4 QuestionnaireResponse from the patient's answers.
 * The calculated total is stored as its own item so downstream systems do not
 * have to re-implement scoring.
 */
export function buildQuestionnaireResponse(
  instrument: Instrument,
  patientId: string,
  answers: Answers,
  authored: string,
): QuestionnaireResponse {
  const { total } = score(instrument, answers);
  const items: QuestionnaireResponse["item"] = [];
  for (const item of answerableItems(instrument.questionnaire)) {
    const option = item.answerOption!.find((o) => o.valueCoding.code === answers[item.linkId]);
    if (!option) continue; // optional unscored item left blank
    items.push({ linkId: item.linkId, text: item.text, answer: [{ valueCoding: option.valueCoding }] });
  }
  const totalItem = instrument.questionnaire.item.find((i) => i.linkId === instrument.totalLinkId);
  items.push({ linkId: instrument.totalLinkId, text: totalItem?.text, answer: [{ valueDecimal: total }] });

  return {
    resourceType: "QuestionnaireResponse",
    questionnaire: instrument.questionnaire.url,
    status: "completed",
    subject: { reference: `Patient/${patientId}` },
    authored,
    item: items,
  };
}

const codingSchema = z.object({ system: z.string().optional(), code: z.string(), display: z.string().optional() });

/** Structural shape of the R4 QuestionnaireResponse subset we accept. */
export const questionnaireResponseSchema = z.object({
  resourceType: z.literal("QuestionnaireResponse"),
  id: z.string().optional(),
  questionnaire: z.string().url(),
  status: z.literal("completed"),
  subject: z.object({ reference: z.string().regex(/^Patient\/[A-Za-z0-9\-.]{1,64}$/) }),
  authored: z.string().datetime({ offset: true }),
  item: z
    .array(
      z.object({
        linkId: z.string().min(1),
        text: z.string().optional(),
        answer: z
          .array(z.object({ valueCoding: codingSchema.optional(), valueDecimal: z.number().optional() }))
          .length(1),
      }),
    )
    .min(1),
});

/**
 * Validate a QuestionnaireResponse against the Questionnaire it claims to answer.
 * Returns a list of human-readable problems; empty means valid.
 */
export function validateQuestionnaireResponse(instrument: Instrument, qr: unknown): string[] {
  const parsed = questionnaireResponseSchema.safeParse(qr);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  const res = parsed.data;
  const errors: string[] = [];
  if (res.questionnaire !== instrument.questionnaire.url) errors.push("questionnaire: does not match instrument");

  const byLinkId = new Map(res.item.map((i) => [i.linkId, i]));
  if (byLinkId.size !== res.item.length) errors.push("item: duplicate linkId");

  const answerable = answerableItems(instrument.questionnaire);
  const known = new Set([...answerable.map((i) => i.linkId), instrument.totalLinkId]);
  for (const linkId of byLinkId.keys()) if (!known.has(linkId)) errors.push(`item ${linkId}: unknown linkId`);

  const scoredIds = new Set(scoredItems(instrument.questionnaire).map((i) => i.linkId));
  const answers: Answers = {};
  for (const q of answerable) {
    const coding = byLinkId.get(q.linkId)?.answer[0].valueCoding;
    if (!coding) {
      if (scoredIds.has(q.linkId)) errors.push(`item ${q.linkId}: required answer missing`);
      continue;
    }
    if (!q.answerOption!.some((o) => o.valueCoding.code === coding.code)) {
      errors.push(`item ${q.linkId}: code ${coding.code} is not a permitted answer`);
      continue;
    }
    answers[q.linkId] = coding.code;
  }
  if (errors.length) return errors;

  const stated = byLinkId.get(instrument.totalLinkId)?.answer[0].valueDecimal;
  const { total } = score(instrument, answers);
  if (stated !== total) errors.push(`item ${instrument.totalLinkId}: total ${stated} does not match calculated ${total}`);
  return errors;
}

/** Recover the answer map from a stored response (used for re-scoring and exports). */
export function answersFrom(qr: QuestionnaireResponse): Answers {
  const answers: Answers = {};
  for (const i of qr.item) {
    const code = i.answer?.[0]?.valueCoding?.code;
    if (code) answers[i.linkId] = code;
  }
  return answers;
}
