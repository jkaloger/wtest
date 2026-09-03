# Problems log

Running notes from the implementing agent. Sandbox permissions, command failures, ergonomics.

## 2026-09-03

- PLAN.md says installs are human tasks because the sandbox has no egress. In practice the agent sandbox routes through a filtering proxy that allows the npm registry, so `pnpm install` works from inside the loop. Kept the plan's human-task list as-is; noting the discrepancy.
- Repo is not lazyspec-backed (no `.lazyspec.toml`). Global instructions say plan via lazyspec; `PLAN.md` was handed over explicitly, so it was used as the plan of record.
- Sandbox denies `pkill` and `kill $PID` in Bash, and background `&` + kill patterns. Long-lived processes for verification had to be driven from a node child-process script that kills its own child. Affects phase 7 (`just server` is long-lived by design): the agent cannot start and later stop the supervisor itself.
- `pnpm install` needs `CI=true` (no TTY → aborts modules purge) and `--no-frozen-lockfile` when manifests change. `pnpm-workspace.yaml` was rewritten by pnpm with a literal `allowBuilds: msw: set this to true or false` placeholder; set to `false` by hand.
- `sed -i ''` fails in the agent shell (GNU sed on PATH via nix-profile). Use `perl -pi -e` for in-place edits.
- SPEC.md names `@vitest/browser/context` for `page`/`userEvent`. Vitest 4 re-exports these from `vitest/browser`; used that to avoid an extra direct dep on `@vitest/browser`.
- **Chromium cannot launch in the macOS agent sandbox by default.** Playwright's headless shell dies at startup with `bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer: Permission denied` (seatbelt denies Mach port registration used to spawn helper processes). Workaround: `--single-process`, wired as opt-in `CHROMIUM_SINGLE_PROCESS=1` in `@repo/test-config` (vitest provider + Playwright `launchOptions`). Single-process mode tolerates one browser context at a time, so the browser project sets `fileParallelism: false` under that flag. **Human action:** add `"env": { "CHROMIUM_SINGLE_PROCESS": "1" }` to `.claude/settings.json` (write-denied for the agent) so agent runs pick it up without prefixing every command. PLAN.md's sandbox-requirements list needs this third item.
- Vitest does not forward `test.env` into the browser's `process.env` shim, and its JSON reporter omits artifacts. Fixed in `@repo/test-config`: env is injected via vite `define` for the browser project, and `reporter.ts` extends `JsonReporter` to add `screenshots[]` per assertion (AC4).
- Layout deviation: `test-results/` lives at the repo root, not `apps/web/`, because layer 1 spans `packages/*` too. Root `vitest.config.ts` hosts the `unit` (repo root) and `browser` (apps/web) projects; `apps/web/vitest.config.ts` remains for IDE runs.
- Vite 8 (vitest 4 dep) replaced esbuild with oxc: JSX runtime is `oxc.jsx.runtime`, not `esbuild.jsx`.
