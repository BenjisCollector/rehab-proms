import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const everything = (id: string) => `/api/fhir/Patient/${id}/$everything`;

test("FHIR export requires authentication", async ({ request }) => {
  const res = await request.get(everything("pat-ada"));
  expect(res.status()).toBe(401);
  expect((await res.json()).resourceType).toBe("OperationOutcome");
});

test("a patient can export their own record but not someone else's", async ({ page }) => {
  await login(page, "ada@example.test");
  await expect(page.getByRole("heading", { name: "Your questionnaires" })).toBeVisible();

  const own = await page.request.get(everything("pat-ada"));
  expect(own.status()).toBe(200);
  expect(own.headers()["content-type"]).toContain("application/fhir+json");
  const bundle = await own.json();
  expect(bundle).toMatchObject({ resourceType: "Bundle", type: "searchset" });

  const other = await page.request.get(everything("pat-cara"));
  expect(other.status()).toBe(404); // indistinguishable from "does not exist"
});

test("a patient cannot open clinician pages", async ({ page }) => {
  await login(page, "ada@example.test");
  await page.goto("/clinician/patients/pat-cara");
  await expect(page).toHaveURL(/\/patient$/);
});

test("unauthenticated visitors are sent to sign in", async ({ page }) => {
  await page.goto("/clinician");
  await expect(page).toHaveURL(/\/login$/);
});

test("crisis signposting is driven by stored answers, not by the URL", async ({ page }) => {
  await login(page, "ada@example.test");
  await page.goto("/patient?submitted=phq-9");
  await expect(page.getByRole("heading", { name: /answers have been sent/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "If you need help now" })).toHaveCount(0);
});
