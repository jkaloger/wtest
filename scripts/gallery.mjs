#!/usr/bin/env node
// Writes test-results/index.html for humans: a summary per layer, then one row per browser and e2e
// test with its screenshots inline. Agents read the JSON reports; this page is derived from them.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const results = resolve("test-results");
const cwd = process.cwd();

function report(name) {
  const file = resolve(results, `${name}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}

const rel = (path) => relative(results, resolve(path));
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

function vitestSummary(name, json) {
  if (!json) return { name, passed: "-", total: "-", ms: "-" };
  const start = Math.min(...json.testResults.map((r) => r.startTime));
  const end = Math.max(...json.testResults.map((r) => r.endTime));
  return {
    name,
    passed: json.numPassedTests,
    total: json.numTotalTests - json.numPendingTests,
    ms: Math.round(end - start),
  };
}

function playwrightSummary(json) {
  if (!json) return { name: "e2e", passed: "-", total: "-", ms: "-" };
  const { expected, unexpected, duration } = json.stats;
  return { name: "e2e", passed: expected, total: expected + unexpected, ms: Math.round(duration) };
}

function vitestRows(layer, json) {
  if (!json) return [];
  return json.testResults.flatMap((file) =>
    file.assertionResults.map((a) => ({
      layer,
      file: relative(cwd, file.name),
      name: a.fullName,
      status: normalise(a.status),
      ms: Math.round(a.duration ?? 0),
      screenshots: (a.screenshots ?? []).map(rel),
      error: (a.failureMessages ?? []).join("\n"),
      trace: null,
    })),
  );
}

function playwrightRows(json) {
  if (!json) return [];
  const rows = [];
  const walk = (suite, file) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        for (const result of test.results) {
          const attachments = result.attachments ?? [];
          rows.push({
            layer: "e2e",
            file,
            name: spec.title,
            status: normalise(result.status),
            ms: Math.round(result.duration),
            screenshots: attachments
              .filter((a) => a.contentType === "image/png" && a.path)
              .map((a) => rel(a.path)),
            error: result.error?.message ?? "",
            trace: attachments.find((a) => a.name === "trace")?.path ?? null,
          });
        }
      }
    }
    for (const child of suite.suites ?? []) walk(child, file);
  };
  for (const suite of json.suites ?? []) walk(suite, suite.file);
  return rows;
}

function normalise(status) {
  if (status === "passed") return "passed";
  if (status === "skipped" || status === "pending" || status === "todo") return "skipped";
  return "failed";
}

function summaryTable(rows) {
  const body = rows
    .map(
      (r) =>
        `<tr><td>${esc(r.name)}</td><td>${esc(r.passed)}/${esc(r.total)}</td><td>${esc(r.ms)}${r.ms === "-" ? "" : "ms"}</td></tr>`,
    )
    .join("");
  return `<table class="summary"><tr><th>layer</th><th>passed</th><th>duration</th></tr>${body}</table>`;
}

function testRow(row) {
  const shots = row.screenshots
    .map(
      (p) => `<a href="${esc(p)}"><img src="${esc(p)}" alt="${esc(row.name)}" loading="lazy"></a>`,
    )
    .join("");
  const trace = row.trace
    ? `<div class="trace">trace: <code>${esc(rel(row.trace))}</code> (<code>playwright show-trace</code>)</div>`
    : "";
  const error = row.error ? `<pre>${esc(row.error)}</pre>` : "";
  return `<tr class="${row.status}">
<td><span class="badge">${row.status}</span><br>${row.ms}ms</td>
<td><div class="layer">${esc(row.layer)}</div><div class="file">${esc(row.file)}</div><div class="name">${esc(row.name)}</div>${error}${trace}</td>
<td class="shots">${shots}</td>
</tr>`;
}

const unit = report("unit");
const browser = report("browser");
const e2e = report("e2e");

const rows = [...vitestRows("browser", browser), ...playwrightRows(e2e)];
const order = { failed: 0, passed: 1, skipped: 2 };
rows.sort((a, b) => order[a.status] - order[b.status]);

const e2eReport = existsSync(resolve(results, "e2e-report/index.html"))
  ? `<p><a href="e2e-report/index.html">Playwright HTML report</a> (embedded trace viewer)</p>`
  : "";

const html = `<!doctype html>
<meta charset="utf-8">
<title>test-results</title>
<style>
body{font:14px/1.4 system-ui,sans-serif;margin:2rem;color:#222}
table{border-collapse:collapse;width:100%}
td,th{border-top:1px solid #ddd;padding:.6rem;vertical-align:top;text-align:left}
.summary{width:auto;margin-bottom:1.5rem}
.badge{font-weight:600;text-transform:uppercase;font-size:.75rem}
tr.passed .badge{color:#1a7f37}tr.failed .badge{color:#cf222e}tr.skipped .badge{color:#888}
.layer{color:#888;font-size:.75rem;text-transform:uppercase}
.file{color:#666;font-family:ui-monospace,monospace;font-size:.8rem}
.name{font-weight:600}
pre{background:#fff5f5;border:1px solid #f3c;padding:.5rem;white-space:pre-wrap;max-height:16rem;overflow:auto;font-size:.8rem}
.trace{color:#666;font-size:.8rem}
.shots img{max-width:320px;max-height:240px;border:1px solid #ccc;margin:0 .5rem .5rem 0;background:#fff}
</style>
<h1>test-results</h1>
<p>generated ${new Date().toISOString()}</p>
${summaryTable([vitestSummary("unit", unit), vitestSummary("browser", browser), playwrightSummary(e2e)])}
${e2eReport}
<table>
<tr><th>status</th><th>test</th><th>screenshots</th></tr>
${rows.map(testRow).join("\n")}
</table>
`;

writeFileSync(resolve(results, "index.html"), html);
console.log(
  `gallery: test-results/index.html (${rows.length} tests, ${rows.reduce((n, r) => n + r.screenshots.length, 0)} screenshots)`,
);
