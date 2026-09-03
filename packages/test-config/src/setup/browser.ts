import { afterAll, afterEach, beforeAll } from "vitest";
import { worker } from "@repo/mocks/browser";

beforeAll(() =>
  worker.start({
    onUnhandledRequest: "error",
    quiet: true,
    serviceWorker: { url: "/mockServiceWorker.js" },
  }),
);
afterEach(() => worker.resetHandlers());
afterAll(() => worker.stop());
