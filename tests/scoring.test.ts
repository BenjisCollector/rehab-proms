import { describe, expect, it } from "vitest";
import { INSTRUMENTS } from "@/lib/fhir/questionnaires";
import { PHQ9_ITEM9_LINK_ID, bandFor, score } from "@/lib/fhir/scoring";
import { answersForTotal } from "@/lib/seed";

const phq9 = INSTRUMENTS["phq-9"];
const gad7 = INSTRUMENTS["gad-7"];

describe("score", () => {
  it("sums ordinal values across all nine PHQ-9 items", () => {
    for (const total of [0, 4, 13, 24]) expect(score(phq9, answersForTotal(phq9, total)).total).toBe(total);
    expect(score(phq9, answersForTotal(phq9, 27, 3)).total).toBe(27);
  });

  it("uses the published severity bands at every boundary", () => {
    const cases: [number, string][] = [[0, "Minimal"], [4, "Minimal"], [5, "Mild"], [9, "Mild"], [10, "Moderate"], [14, "Moderate"], [15, "Moderately severe"], [19, "Moderately severe"], [20, "Severe"], [27, "Severe"]];
    for (const [total, band] of cases) expect(bandFor(phq9, total)).toBe(band);
    expect(bandFor(gad7, 14)).toBe("Moderate");
    expect(bandFor(gad7, 15)).toBe("Severe");
  });

  it("raises an urgent alert whenever PHQ-9 item 9 is above zero, even with a low total (H-01)", () => {
    const result = score(phq9, answersForTotal(phq9, 1, 1));
    expect(result.total).toBe(1);
    expect(result.alerts).toEqual([expect.objectContaining({ rule: "PHQ9_ITEM9", severity: "urgent" })]);
  });

  it("does not raise the item 9 alert when item 9 is zero", () => {
    expect(score(phq9, answersForTotal(phq9, 19, 0)).alerts).toEqual([]);
  });

  it("raises a high alert at the severe threshold for each instrument (H-02)", () => {
    expect(score(phq9, answersForTotal(phq9, 20)).alerts.map((a) => a.rule)).toEqual(["SEVERE_TOTAL"]);
    expect(score(gad7, answersForTotal(gad7, 15)).alerts.map((a) => a.rule)).toEqual(["SEVERE_TOTAL"]);
    expect(score(gad7, answersForTotal(gad7, 14)).alerts).toEqual([]);
  });

  it("refuses to score an incomplete set of answers rather than under-reporting (H-03)", () => {
    const answers = answersForTotal(phq9, 12, 1);
    delete answers[PHQ9_ITEM9_LINK_ID];
    expect(() => score(phq9, answers)).toThrow(/Missing or invalid answer/);
  });

  it("refuses unknown answer codes", () => {
    const answers = { ...answersForTotal(gad7, 3), "/69725-0": "LA9999-9" };
    expect(() => score(gad7, answers)).toThrow();
  });
});
