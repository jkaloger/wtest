// AC4 probe only: `DEMO_FAIL=1 just test-browser` must exit non-zero and leave a PNG under
// test-results/browser/ whose path appears in test-results/browser.json.
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";

test.skipIf(process.env.DEMO_FAIL !== "1")(
  "deliberately fails to prove screenshot capture",
  async () => {
    const screen = await render(<p>demo failure</p>);
    await expect
      .element(screen.getByText("this text never renders"), { timeout: 500 })
      .toBeVisible();
  },
);
