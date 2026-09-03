// The macOS agent sandbox denies the Mach port bootstrap Chromium needs to spawn helper
// processes (`MachPortRendezvousServer: Permission denied`). Single-process mode sidesteps it
// but tolerates only one browser context at a time, so files must run serially.
// Opt-in only: CI and humans run the normal multi-process browser.
export function singleProcess(): boolean {
  return process.env.CHROMIUM_SINGLE_PROCESS === "1";
}

export function chromiumArgs(): string[] {
  return singleProcess() ? ["--single-process"] : [];
}
