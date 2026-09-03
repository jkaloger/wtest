// AC11 probe only. `DEMO_FAIL=1 just test-e2e` must exit non-zero and leave a PNG under
// test-results/e2e/ whose path appears in test-results/e2e.json attachments[].
import { expect, test } from "@repo/test-config/playwright";

test.skip(process.env.DEMO_FAIL !== "1", "AC11 probe");

test("deliberately fails to prove screenshot capture", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("this text never renders")).toBeVisible({ timeout: 500 });
});
