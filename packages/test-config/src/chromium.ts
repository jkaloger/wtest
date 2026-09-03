// The macOS agent sandbox denies the Mach port bootstrap Chromium needs to spawn helper
// processes (`MachPortRendezvousServer: Permission denied`). Single-process mode sidesteps it
// but tolerates only one browser context at a time, so files must run serially.
// Auto-detected for Claude Code on macOS (CLAUDECODE=1); CHROMIUM_SINGLE_PROCESS=1|0 overrides.
// CI and humans run the normal multi-process browser.
export function singleProcess(): boolean {
  const flag = process.env.CHROMIUM_SINGLE_PROCESS;
  if (flag !== undefined) return flag === "1";
  return process.platform === "darwin" && process.env.CLAUDECODE === "1";
}

export function chromiumArgs(): string[] {
  return singleProcess() ? ["--single-process"] : [];
}
