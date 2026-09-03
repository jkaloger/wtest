import { resolve } from "node:path";
import {
  defineConfig,
  test as base,
  type BrowserContext,
  type PlaywrightTestConfig,
} from "@playwright/test";
import { authUser, userSession, type AuthUser } from "@repo/mocks/auth";
import { chromiumArgs, singleProcess } from "./chromium.ts";
import { reports, RESULTS_DIR } from "./vitest.ts";

export { expect } from "@playwright/test";

export const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";
export const MOCK_URL = process.env.MOCK_URL ?? `http://127.0.0.1:${process.env.MOCK_PORT ?? 4010}`;

export type PlaywrightOptions = {
  testDir: string;
  /** Absolute path of the directory holding `test-results/`. Defaults to the config file's cwd. */
  resultsRoot?: string;
  baseURL?: string;
};

// No webServer block on purpose: `just server` (process-compose) owns the app and mock server.
export function playwrightConfig({
  testDir,
  resultsRoot = process.cwd(),
  baseURL = APP_URL,
}: PlaywrightOptions): PlaywrightTestConfig {
  return defineConfig({
    testDir,
    testMatch: "**/*.spec.ts",
    outputDir: resolve(resultsRoot, RESULTS_DIR, "e2e"),
    reporter: [["line"], ["json", { outputFile: resolve(resultsRoot, reports.e2e) }]],
    fullyParallel: false,
    workers: 1,
    maxFailures: 3,
    retries: 0,
    timeout: 15_000,
    use: {
      baseURL,
      trace: "retain-on-failure",
      screenshot: "only-on-failure",
      video: "off",
      launchOptions: { args: chromiumArgs() },
    },
    projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  });
}

export type Mock = {
  scenario: (name: string, ...args: unknown[]) => Promise<void>;
  reset: () => Promise<void>;
};

export async function applyScenario(
  name: string,
  args: unknown[] = [],
  origin = "supabase",
): Promise<void> {
  const res = await fetch(`${MOCK_URL}/__scenario`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ origin, name, args }),
  });
  if (!res.ok) {
    throw new Error(`__scenario ${origin}.${name} failed: ${res.status} ${await res.text()}`);
  }
}

export async function resetMocks(): Promise<void> {
  const res = await fetch(`${MOCK_URL}/__reset`, { method: "POST" });
  if (!res.ok) throw new Error(`__reset failed: ${res.status}`);
}

type Fixtures = {
  mock: Mock;
  authed: AuthUser;
};

type WorkerFixtures = {
  // Single-process Chromium dies when a context closes, so one context serves the whole worker.
  sharedContext: BrowserContext | null;
};

export const test = base.extend<Fixtures, WorkerFixtures>({
  sharedContext: [
    async ({ browser }, use) => {
      if (!singleProcess()) {
        await use(null);
        return;
      }
      const context = await browser.newContext();
      await use(context);
      await context.close();
    },
    { scope: "worker" },
  ],

  context: async ({ browser, contextOptions, sharedContext }, use) => {
    if (!sharedContext) {
      const context = await browser.newContext(contextOptions);
      await use(context);
      await context.close();
      return;
    }
    await sharedContext.clearCookies();
    await use(sharedContext);
    for (const page of sharedContext.pages()) await page.close();
  },

  mock: [
    // Playwright requires the destructuring pattern even with no dependencies.
    // oxlint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await resetMocks();
      await use({ scenario: (name, ...args) => applyScenario(name, args), reset: resetMocks });
    },
    { auto: true },
  ],

  authed: async ({ context, baseURL, mock }, use) => {
    const user = authUser();
    await mock.scenario("auth.user", user);
    const cookies = userSession(user).cookies.map(({ name, value }) => ({
      name,
      value,
      url: baseURL ?? APP_URL,
    }));
    await context.addCookies(cookies);
    await use(user);
  },
});
