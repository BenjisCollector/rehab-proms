"use server";

import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { answerableItems, getInstrument, scoredItems } from "@/lib/fhir/questionnaires";
import type { Answers } from "@/lib/fhir/scoring";
import { submitResponse } from "@/lib/repo";
import { currentUser } from "@/lib/session";

export interface FormState {
  errors?: Record<string, string>;
  values?: Answers;
}

export async function submitQuestionnaire(instrumentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  // Authorise inside the action: never trust that the page that rendered the form did it.
  const user = await currentUser();
  if (!user || user.role !== "patient" || !user.patient_id) redirect("/login");
  const instrument = getInstrument(instrumentId);
  if (!instrument) redirect("/patient");

  const values: Answers = {};
  for (const item of answerableItems(instrument.questionnaire)) {
    const v = formData.get(item.linkId);
    if (typeof v === "string" && item.answerOption!.some((o) => o.valueCoding.code === v)) values[item.linkId] = v;
  }
  const errors: Record<string, string> = {};
  scoredItems(instrument.questionnaire).forEach((item, n) => {
    if (!values[item.linkId]) errors[item.linkId] = `Answer question ${n + 1}`;
  });
  if (Object.keys(errors).length) return { errors, values };

  const { id } = submitResponse(instrument, user.patient_id, values);
  audit({ id: user.id, role: user.role }, "create", "QuestionnaireResponse", id);
  redirect(`/patient?submitted=${instrument.id}`);
}
