import { expect, test } from "@playwright/test";

// Identifiants et jeton fournis par l'environnement de test (seed avec SEED_DEMO=1) : aucun secret dans le dépôt.
const EMAIL = process.env.E2E_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const DEMO_TOKEN = process.env.E2E_DEMO_TOKEN ?? "";

test("parcours organisateur jusqu'à l'émargement public", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD || !DEMO_TOKEN, "E2E_EMAIL, E2E_PASSWORD et E2E_DEMO_TOKEN requis");
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel(/^Mot de passe/).fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/dashboard/);

  await page.goto(`/r/${DEMO_TOKEN}`);
  await expect(page.getByText("RÉUNION DE DÉMONSTRATION")).toBeVisible();
});
