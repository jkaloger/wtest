import { afterAll, afterEach, beforeAll } from "vitest";
import { page, server } from "vitest/browser";
import { worker } from "@repo/mocks/browser";
import { passScreenshotPath } from "../screenshots.ts";

beforeAll(() =>
  worker.start({
    onUnhandledRequest: "error",
    quiet: true,
    serviceWorker: { url: "/mockServiceWorker.js" },
  }),
);
afterEach(() => worker.resetHandlers());
afterAll(() => worker.stop());

// Vitest screenshots failures itself; the reporter derives this path the same way.
afterEach(async ({ task }) => {
  if (process.env.SCREENSHOTS !== "all") return;
  if (task.result?.state === "fail") return;
  await page.screenshot({
    path: passScreenshotPath({
      root: server.config.root,
      screenshotDirectory: process.env.SCREENSHOT_DIR ?? "",
      file: task.file.filepath,
      fullName: task.name,
    }),
  });
});
