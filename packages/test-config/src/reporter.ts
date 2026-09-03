// Vitest's JSON reporter omits artifacts. Agents read reports, not consoles, so screenshot paths
// are copied onto each assertion result as `screenshots: string[]` (AC4, AC12): the failure
// screenshots vitest takes itself, plus the pass screenshots setup/browser.ts takes under
// SCREENSHOTS=all at a path both sides derive from the test.
import { existsSync } from "node:fs";
import type { TestCase, TestModule } from "vitest/node";
import { JsonReporter } from "vitest/node";
import { passScreenshotPath } from "./screenshots.ts";

type Assertion = { fullName: string; status: string; screenshots?: string[] };
type Report = { testResults: { name: string; assertionResults: Assertion[] }[] };

const FAILURE_SCREENSHOT = "internal:failureScreenshot";

export default class HarnessJsonReporter extends JsonReporter {
  #modules: ReadonlyArray<TestModule> = [];

  override async onTestRunEnd(...args: Parameters<JsonReporter["onTestRunEnd"]>): Promise<void> {
    this.#modules = args[0];
    return super.onTestRunEnd(...args);
  }

  override async writeReport(report: string): Promise<void> {
    const json = JSON.parse(report) as Report;
    const byFile = new Map(this.#modules.map((m) => [m.moduleId, m]));
    for (const file of json.testResults) {
      const tests = [...(byFile.get(file.name)?.children.allTests() ?? [])];
      for (const assertion of file.assertionResults) {
        const test = tests.find((t) => t.fullName === assertion.fullName);
        if (!test) continue;
        const screenshots =
          assertion.status === "passed" ? passScreenshots(test) : failureScreenshots(test);
        if (screenshots.length) assertion.screenshots = screenshots;
      }
    }
    return super.writeReport(JSON.stringify(json));
  }
}

function failureScreenshots(test: TestCase): string[] {
  return test.artifacts().flatMap((artifact) => {
    if (artifact.type !== FAILURE_SCREENSHOT) return [];
    return (artifact.attachments ?? []).flatMap((a) => {
      const path = (a as { originalPath?: string; path?: string }).originalPath ?? a.path;
      return path ? [path] : [];
    });
  });
}

function passScreenshots(test: TestCase): string[] {
  if (process.env.SCREENSHOTS !== "all") return [];
  const { root, browser } = test.project.config;
  if (!browser.screenshotDirectory) return [];
  const path = passScreenshotPath({
    root,
    screenshotDirectory: browser.screenshotDirectory,
    file: test.module.moduleId,
    fullName: test.fullName,
  });
  return existsSync(path) ? [path] : [];
}
