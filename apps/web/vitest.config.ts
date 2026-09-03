// Standalone entry for IDE runs inside apps/web. `just test*` uses the root vitest.config.ts,
// which also covers packages/* in layer 1 and writes reports to the repo-root test-results/.
import { defineConfig } from "vitest/config";
import { browserProject, loadTestEnv, unitProject } from "@repo/test-config/vitest";

const root = import.meta.dirname;
const env = loadTestEnv(root, { passthrough: ["DEMO_FAIL"] });

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    projects: [unitProject({ root, env }), browserProject({ root, env })],
  },
});
