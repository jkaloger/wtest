import { expect, test } from "@repo/test-config/playwright";

test("/ renders the public landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Harness proving ground");
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("/login renders the sign-in form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("/dashboard renders profiles for a signed-in user", async ({ page, authed }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  await expect(page.getByText(`Signed in as ${authed.email}`)).toBeVisible();
  await expect(page.getByRole("list", { name: "profiles" }).getByRole("listitem")).toHaveCount(3);
});
