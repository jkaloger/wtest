#!/usr/bin/env node
// One page, one PNG, no test run: the agent loop's "what does this look like now". The playwright
// CLI's own `screenshot` command can't pass browser args and the sandbox needs --single-process,
// hence this. It lives beside the browser config rather than in scripts/ because only this package
// depends on playwright.
import { chromium } from "playwright";

import { chromiumArgs } from "./chromium.ts";

const [url, path] = process.argv.slice(2);
if (!url || !path) {
  console.error("usage: shot <url> <path>");
  process.exit(1);
}

const browser = await chromium.launch({ args: chromiumArgs() });
const page = await browser.newPage();
const response = await page.goto(url, { waitUntil: "networkidle" });
await page.screenshot({ path, fullPage: true });
await browser.close();

console.log(`${response?.status() ?? "?"} ${url} -> ${path}`);
