import { expect, mainAlert, test } from "@repo/test-config/playwright";
import { fixtures } from "@repo/mocks/supabase";

test("sign-in form drives the server action through mocked /auth/v1/token", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(fixtures.authUser().email);
  await page.getByLabel("Password").fill(fixtures.FIXTURE_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
});

test("wrong password stays on /login with an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(fixtures.authUser().email);
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login\?error=invalid_credentials$/);
  await expect(mainAlert(page)).toHaveText("Invalid login credentials.");
});
