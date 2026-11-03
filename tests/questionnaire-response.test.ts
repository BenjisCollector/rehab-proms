import { describe, expect, it } from "vitest";
import { INSTRUMENTS } from "@/lib/fhir/questionnaires";
import { answersFrom, buildQuestionnaireResponse, validateQuestionnaireResponse } from "@/lib/fhir/questionnaire-response";
import { answersForTotal } from "@/lib/seed";

const phq9 = INSTRUMENTS["phq-9"];
const authored = "2026-11-01T10:00:00.000Z";

function valid() {
  return buildQuestionnaireResponse(phq9, "pat-test", answersForTotal(phq9, 11, 1), authored);
}

describe("QuestionnaireResponse", () => {
  it("builds a valid R4 response that references the canonical LOINC questionnaire", () => {
    const qr = valid();
    expect(qr.resourceType).toBe("QuestionnaireResponse");
    expect(qr.questionnaire).toBe("http://loinc.org/q/44249-1");
    expect(qr.subject.reference).toBe("Patient/pat-test");
    expect(validateQuestionnaireResponse(phq9, qr)).toEqual([]);
  });

  it("stores the calculated total as the LOINC total-score item", () => {
    const total = valid().item.find((i) => i.linkId === "/44261-6");
    expect(total?.answer?.[0].valueDecimal).toBe(11);
  });

  it("round-trips answers", () => {
    const answers = answersForTotal(phq9, 7);
    expect(answersFrom(buildQuestionnaireResponse(phq9, "p", answers, authored))).toEqual(answers);
  });

  it("rejects a tampered total", () => {
    const qr = valid();
    qr.item.find((i) => i.linkId === "/44261-6")!.answer = [{ valueDecimal: 2 }];
    expect(validateQuestionnaireResponse(phq9, qr)).toEqual([expect.stringMatching(/does not match calculated 11/)]);
  });

  it("rejects a missing required item", () => {
    const qr = valid();
    qr.item = qr.item.filter((i) => i.linkId !== "/44260-8");
    expect(validateQuestionnaireResponse(phq9, qr)).toContain("item /44260-8: required answer missing");
  });

  it("rejects codes that are not answer options, and unknown linkIds", () => {
    const qr = valid();
    qr.item[0].answer = [{ valueCoding: { system: "http://loinc.org", code: "LA0000-0" } }];
    qr.item.push({ linkId: "/made-up", answer: [{ valueDecimal: 1 }] });
    const errors = validateQuestionnaireResponse(phq9, qr);
    expect(errors).toContain("item /made-up: unknown linkId");
    expect(errors.some((e) => e.includes("is not a permitted answer"))).toBe(true);
  });

  it("rejects structurally invalid resources", () => {
    expect(validateQuestionnaireResponse(phq9, { resourceType: "Patient" })).not.toEqual([]);
    expect(validateQuestionnaireResponse(phq9, { ...valid(), authored: "yesterday" })).toEqual([
      expect.stringMatching(/^authored/),
    ]);
    expect(validateQuestionnaireResponse(phq9, { ...valid(), subject: { reference: "Patient/../../etc" } })).not.toEqual([]);
  });

  it("rejects a response submitted against the wrong questionnaire", () => {
    expect(validateQuestionnaireResponse(INSTRUMENTS["gad-7"], valid())).not.toEqual([]);
  });
});
