// Shared by setup/browser.ts (browser, no node:path) and reporter.ts (node). Vitest rejects
// `annotate` from afterEach because the test has already passed, so the hook and the reporter
// agree on a path instead. Mirrors vitest's failure tree `<dir>/<file>/<test>-1.png` minus the
// counter, so the two never collide.
export type PassScreenshot = {
  root: string;
  screenshotDirectory: string;
  file: string;
  fullName: string;
};

export function passScreenshotPath({
  root,
  screenshotDirectory,
  file,
  fullName,
}: PassScreenshot): string {
  const relativeFile = file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file;
  return `${screenshotDirectory}/${relativeFile}/${sanitize(fullName)}.png`;
}

function sanitize(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
}
