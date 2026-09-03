import { resolve } from "node:path";
import { playwright } from "@vitest/browser-playwright";
import type { TestProjectInlineConfiguration } from "vitest/config";

export const RESULTS_DIR = "test-results";

export const reports = {
  unit: `${RESULTS_DIR}/unit.json`,
  browser: `${RESULTS_DIR}/browser.json`,
  e2e: `${RESULTS_DIR}/e2e.json`,
} as const;

export type ProjectOptions = {
  /** Absolute path of the app or package root. Screenshots and reports resolve against it. */
  root: string;
  /** Extra include globs. Defaults cover the SPEC.md file patterns. */
  include?: string[];
};

const BROWSER_TESTS = "**/*.browser.test.{ts,tsx}";
const E2E_DIR = "e2e/**";

export function unitProject({
  root,
  include = [],
}: ProjectOptions): TestProjectInlineConfiguration {
  return {
    extends: true,
    test: {
      name: "unit",
      root,
      environment: "node",
      include: ["**/*.test.{ts,tsx}", ...include],
      exclude: [BROWSER_TESTS, E2E_DIR, "**/node_modules/**", "**/.next/**"],
      setupFiles: ["@repo/test-config/setup/unit"],
    },
  };
}

export function browserProject({
  root,
  include = [],
}: ProjectOptions): TestProjectInlineConfiguration {
  return {
    extends: true,
    test: {
      name: "browser",
      root,
      include: [BROWSER_TESTS, ...include],
      exclude: [E2E_DIR, "**/node_modules/**", "**/.next/**"],
      setupFiles: ["@repo/test-config/setup/browser"],
      browser: {
        enabled: true,
        provider: playwright(),
        instances: [{ browser: "chromium" }],
        headless: true,
        screenshotFailures: true,
        // Absolute: vitest resolves a relative value against each test file's directory.
        screenshotDirectory: resolve(root, RESULTS_DIR, "browser"),
      },
    },
  };
}
