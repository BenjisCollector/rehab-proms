import AxeBuilder from "@axe-core/playwright";
import { type Page, expect } from "@playwright/test";

export const PASSWORD = "demo-password-not-secret";

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname !== "/login");
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
}

/** Fails the test on any WCAG 2.2 A/AA violation axe can detect on the current page. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}

/** README screenshots, only when SCREENSHOTS=1. */
export async function shot(page: Page, name: string) {
  if (process.env.SCREENSHOTS) await page.screenshot({ path: `docs/screenshots/${name}.png`, fullPage: true });
}

export async function shotMobile(page: Page, name: string) {
  if (!process.env.SCREENSHOTS) return;
  const size = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `docs/screenshots/${name}.png` });
  if (size) await page.setViewportSize(size);
}
