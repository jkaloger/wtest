#!/usr/bin/env node
// Prints wall-clock durations from the JSON reports. Soft targets from SPEC.md; nothing fails here.
import { existsSync, readFileSync } from "node:fs";

const targets = { unit: 5000, browser: 10000, e2e: 60000 };
const rows = [];

function vitest(name) {
  const file = `test-results/${name}.json`;
  if (!existsSync(file)) return rows.push([name, "missing", "", targets[name]]);
  const json = JSON.parse(readFileSync(file, "utf8"));
  const start = Math.min(...json.testResults.map((r) => r.startTime));
  const end = Math.max(...json.testResults.map((r) => r.endTime));
  rows.push([
    name,
    `${json.numPassedTests}/${json.numTotalTests - json.numPendingTests}`,
    Math.round(end - start),
    targets[name],
  ]);
}

function playwright() {
  const file = "test-results/e2e.json";
  if (!existsSync(file)) return rows.push(["e2e", "missing", "", targets.e2e]);
  const json = JSON.parse(readFileSync(file, "utf8"));
  rows.push([
    "e2e",
    `${json.stats.expected}/${json.stats.expected + json.stats.unexpected}`,
    Math.round(json.stats.duration),
    targets.e2e,
  ]);
}

vitest("unit");
vitest("browser");
playwright();

console.log("\nlayer     passed   duration   soft target");
for (const [name, passed, ms, target] of rows) {
  const dur = ms === "" ? "-" : `${ms}ms`;
  const flag = ms !== "" && ms > target ? "  (over)" : "";
  console.log(
    `${name.padEnd(9)} ${String(passed).padEnd(8)} ${dur.padEnd(10)} <${target}ms${flag}`,
  );
}
