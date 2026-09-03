import { resolve } from "node:path";
import { playwrightConfig } from "@repo/test-config/playwright";

export default playwrightConfig({
  testDir: "./e2e",
  resultsRoot: resolve(import.meta.dirname, "../.."),
});
