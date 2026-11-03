import { expect, test } from "@playwright/test";
import { expectAccessible, login, logout, shot, shotMobile } from "./helpers";

test.describe.serial("patient submits PHQ-9, clinician reviews the alert", () => {
  test("patient: validation, submission and crisis signposting", async ({ page }) => {
    await login(page, "dev@example.test");
    await expect(page.getByRole("heading", { name: "Your questionnaires" })).toBeVisible();
    await expect(page.getByText("You have not sent any answers yet.")).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("link", { name: "Start PHQ-9" }).click();
    await expect(page.getByRole("heading", { name: "PHQ-9" })).toBeVisible();
    await expectAccessible(page);
    await shotMobile(page, "patient-questionnaire-mobile");

    // Submitting nothing shows an error summary that takes focus.
    await page.getByRole("button", { name: "Send my answers" }).click();
    const summary = page.getByRole("heading", { name: "There is a problem" });
    await expect(summary).toBeVisible();
    await expect(page.locator(".error-summary")).toBeFocused();
    await expect(page.locator(".error-summary li")).toHaveCount(9);
    await expectAccessible(page);

    // Answer everything "Not at all" except item 9.
    const groups = page.getByRole("group");
    const count = await groups.count();
    for (let i = 0; i < count; i++) {
      const group = groups.nth(i);
      if ((await group.textContent())?.includes("better off dead")) await group.getByLabel("Several days").check();
      else if ((await group.textContent())?.includes("How difficult")) continue; // optional item
      else await group.getByLabel("Not at all").check();
    }
    await page.getByRole("button", { name: "Send my answers" }).click();

    await expect(page.getByRole("heading", { name: /your PHQ-9 answers have been sent/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "If you need help now" })).toBeVisible();
    await expect(page.getByText("116 123")).toBeVisible();
    await expectAccessible(page);
    await shot(page, "patient-signposting");
    await logout(page);
  });

  test("clinician: caseload ranks the new urgent alert, review is audited", async ({ page }) => {
    await login(page, "clinician@example.test");
    await expect(page.getByRole("heading", { name: "Caseload" })).toBeVisible();
    const devRow = page.getByRole("row", { name: /Synthetic, Dev/ });
    await expect(devRow.getByText("1 urgent")).toBeVisible();
    await expectAccessible(page);
    await shot(page, "clinician-caseload");

    await page.getByRole("link", { name: "Placeholder, Cara" }).click();
    await expect(page.getByRole("heading", { name: "Score trends" })).toBeVisible();
    await expectAccessible(page);
    await shot(page, "clinician-patient");

    await page.goto("/clinician");
    await devRow.getByRole("link").click();
    await expect(page.getByText(/item 9 \(thoughts of self-harm\)/)).toBeVisible();
    await page.getByRole("button", { name: "Mark as reviewed" }).click();
    await expect(page.getByRole("heading", { name: "Alerts to review (0)" })).toBeVisible();

    await page.getByRole("link", { name: "Audit log" }).click();
    await expectAccessible(page);
    await expect(page.getByRole("row", { name: /usr-dev \(patient\) create QuestionnaireResponse/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /usr-clinician \(clinician\) update Flag/ }).first()).toBeVisible();
    await shot(page, "clinician-audit");
  });
});
