# dom-test: agent notes

Plan of record is `PLAN.md`; this repo is deliberately not lazyspec-backed. Spec is `SPEC.md`. Log
sandbox findings in `PROBLEMS.md` with a status tag.

Run every recipe as `direnv exec . just <recipe>`. Loop: `just check && just test` per iteration,
`just test-all` before declaring done.

## Sandbox gotchas (macOS, Claude Code)

- GNU sed is on PATH: `sed -i ''` fails. Use `perl -pi -e`.
- `kill`, `pkill`, background `&` + kill, and bare `curl` are denied in the agent shell. Supervisor
  lifecycle goes through `just server -D` / `just server-restart` / `just server-down`; it also stops
  itself after `PC_TTL` seconds. Probe loopback with `just http <url>`.
- Chromium needs `--single-process` here. `@repo/test-config` detects `CLAUDECODE=1` on darwin and
  does it automatically; `CHROMIUM_SINGLE_PROCESS=1|0` overrides.
- `.env*` files are unreadable and shell commands naming them are denied. The test dotenv is
  `test.env` for that reason; keep it that way.
- Unix sockets in the repo are denied; process-compose talks TCP on `PC_PORT` (8474).
- `just install` (`CI=true pnpm install --frozen-lockfile`) works through the proxy. Use
  `just install-update` after manifest edits, then let a human review the lockfile diff.
- Nix daemon is out of reach. If `direnv exec` tries to call nix, the devShell cache is stale: stop
  and ask a human to re-enter the directory.
