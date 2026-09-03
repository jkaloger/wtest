import { expect, test } from "@repo/test-config/playwright";

test("anonymous /dashboard is redirected to /login by proxy.ts", async ({ page }) => {
  const response = await page.goto("/dashboard");
  expect(response?.request().redirectedFrom()?.url()).toContain("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});
