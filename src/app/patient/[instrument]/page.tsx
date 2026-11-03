import Link from "next/link";
import { notFound } from "next/navigation";
import { answerableItems, getInstrument, scoredItems } from "@/lib/fhir/questionnaires";
import { requireRole } from "@/lib/session";
import { type FormItem, QuestionnaireForm } from "./questionnaire-form";

export default async function QuestionnairePage({ params }: { params: Promise<{ instrument: string }> }) {
  await requireRole("patient");
  const instrument = getInstrument((await params).instrument);
  if (!instrument) notFound();

  const scored = new Set(scoredItems(instrument.questionnaire).map((i) => i.linkId));
  const items: FormItem[] = answerableItems(instrument.questionnaire).map((i) => ({
    linkId: i.linkId,
    text: i.text ?? "",
    required: scored.has(i.linkId),
    options: i.answerOption!.map((o) => ({ code: o.valueCoding.code!, display: o.valueCoding.display! })),
  }));

  return (
    <div className="narrow">
      <p>
        <Link href="/patient" className="back-link">
          Back to your questionnaires
        </Link>
      </p>
      <h1>{instrument.shortName}</h1>
      <QuestionnaireForm instrumentId={instrument.id} stem={instrument.stem} items={items} />
      <p className="small">{instrument.questionnaire.copyright}</p>
    </div>
  );
}
