import { defineConfig } from "vitest/config";
import { browserProject, unitProject } from "@repo/test-config/vitest";

const root = import.meta.dirname;

export default defineConfig({
  // Next wants `jsx: preserve` in tsconfig, which vite would otherwise inherit.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    projects: [unitProject({ root }), browserProject({ root })],
  },
});
