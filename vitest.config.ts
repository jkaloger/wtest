import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { browserProject, loadTestEnv, unitProject } from "@repo/test-config/vitest";

const root = import.meta.dirname;
const web = resolve(root, "apps/web");
const env = loadTestEnv(root, { passthrough: ["DEMO_FAIL"] });

export default defineConfig({
  // Next wants `jsx: preserve` in tsconfig, which vite would otherwise inherit.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    projects: [
      unitProject({
        root,
        env,
        include: ["apps/*/src/**/*.test.{ts,tsx}", "packages/*/src/**/*.test.{ts,tsx}"],
      }),
      browserProject({ root: web, resultsRoot: root, env }),
    ],
  },
});
