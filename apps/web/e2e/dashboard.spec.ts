import { expect, test } from "@repo/test-config/playwright";

test("profiles outage renders the error state", async ({ page, authed, mock }) => {
  await mock.scenario("serverError", "profiles");
  await page.goto("/dashboard");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Could not load profiles");
  await expect(page.getByText(`Signed in as ${authed.email}`)).toBeVisible();
});

test("profile search hits the mock origin from the browser", async ({ page, authed: _authed }) => {
  await page.goto("/dashboard");
  await page.getByRole("searchbox").fill("gra");
  await expect(page.locator("section").getByRole("listitem")).toHaveText(["Grace Hopper"]);
});
