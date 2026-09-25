import { expect, test } from "@playwright/test";

test("parcours organisateur jusqu'à l'émargement public", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@sodefor.ci");
  await page.getByLabel("Mot de passe").fill("Admin@Sodefor2026!");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/dashboard/);

  await page.goto("/r/demo-comite-technique-sodefor-2026-token");
  await expect(page.getByText("COMITE TECHNIQUE")).toBeVisible();
});
