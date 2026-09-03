import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { chromiumArgs, singleProcess } from "./chromium.ts";
import type { TestProjectInlineConfiguration } from "vitest/config";

export const RESULTS_DIR = "test-results";

export const reports = {
  unit: `${RESULTS_DIR}/unit.json`,
  browser: `${RESULTS_DIR}/browser.json`,
  e2e: `${RESULTS_DIR}/e2e.json`,
} as const;

export type ProjectOptions = {
  /** Absolute path the project's include globs resolve against. */
  root: string;
  /** Absolute path of the directory holding `test-results/`. Defaults to `root`. */
  resultsRoot?: string;
  /** Replaces the default include globs. */
  include?: string[];
  /** Values exposed to tests as `process.env`. Loopback URLs from `test.env` belong here. */
  env?: Record<string, string>;
};

const BROWSER_TESTS = "**/*.browser.test.{ts,tsx}";
const ALWAYS_EXCLUDED = ["**/node_modules/**", "**/.next/**", "**/e2e/**", `**/${RESULTS_DIR}/**`];

export function unitProject({
  root,
  include = ["**/*.test.{ts,tsx}"],
  env = {},
}: ProjectOptions): TestProjectInlineConfiguration {
  return {
    extends: true,
    test: {
      name: "unit",
      root,
      environment: "node",
      include,
      exclude: [BROWSER_TESTS, ...ALWAYS_EXCLUDED],
      setupFiles: ["@repo/test-config/setup/unit"],
      env,
    },
  };
}

export function browserProject({
  root,
  resultsRoot = root,
  include = [BROWSER_TESTS],
  env = {},
}: ProjectOptions): TestProjectInlineConfiguration {
  const screenshotDirectory = resolve(resultsRoot, RESULTS_DIR, "browser");
  return {
    extends: true,
    // Next inlines NEXT_PUBLIC_* at build time; mirror that (for every key: loopback test values only)
    // because vitest does not forward `test.env` into the browser's process.env shim.
    define: envDefine({
      ...env,
      SCREENSHOTS: process.env.SCREENSHOTS ?? "failures",
      SCREENSHOT_DIR: screenshotDirectory,
    }),
    optimizeDeps: { include: ["react/jsx-dev-runtime"] },
    test: {
      name: "browser",
      fileParallelism: !singleProcess(),
      root,
      include,
      exclude: ALWAYS_EXCLUDED,
      setupFiles: ["@repo/test-config/setup/browser"],
      env,
      browser: {
        enabled: true,
        provider: playwright({ launchOptions: { args: chromiumArgs() } }),
        instances: [{ browser: "chromium" }],
        headless: true,
        screenshotFailures: true,
        // Absolute: vitest resolves a relative value against each test file's directory.
        screenshotDirectory,
      },
    },
  };
}

export function envDefine(env: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)]),
  );
}

// `just` loads test.env via dotenv-load; this makes bare `vitest` and IDE runs see the same values.
export type TestEnvOptions = {
  filename?: string;
  /** Extra process.env keys forwarded to tests even though test.env does not declare them. */
  passthrough?: string[];
};

export function loadTestEnv(
  startDir: string,
  { filename = "test.env", passthrough = [] }: TestEnvOptions = {},
): Record<string, string> {
  const file = findUp(startDir, filename);
  if (!file) throw new Error(`${filename} not found above ${startDir}`);
  const fromFile = parseDotenv(readFileSync(file, "utf8"));
  const fromProcess = Object.fromEntries(
    [...Object.keys(fromFile), ...passthrough].flatMap((key) => {
      const value = process.env[key];
      return value === undefined ? [] : [[key, value]];
    }),
  );
  return { ...fromFile, ...fromProcess };
}

function findUp(start: string, filename: string): string | null {
  let dir = start;
  for (;;) {
    const candidate = resolve(dir, filename);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function parseDotenv(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, "$2");
    out[key] = value;
  }
  return out;
}
