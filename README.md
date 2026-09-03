# dom-test

Proving ground for [`SPEC.md`](./SPEC.md): a three-layer test harness (Vitest node, Vitest browser
mode, Playwright) fed by one set of MSW handlers, with zero network egress. The toy Next.js app
under `apps/web` exists only to exercise the harness.

`PLAN.md` sequences the build. `PROBLEMS.md` records what went wrong while building it and why the
implementation deviates from the spec where it does. `VERSIONS.md` records the resolved dependency
pins.

## Run it locally

Setup phase, once, with network (`just install` also works from inside the agent sandbox when its proxy admits the registry):

```sh
direnv allow          # nix devShell: node, pnpm, just, process-compose, oxlint, oxfmt, chromium
pnpm install
```

Everything else goes through `just`. Agents run recipes as `direnv exec . just <recipe>`.

| Recipe                 | What it does                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `just check`           | oxlint, oxfmt `--check`, `tsc --noEmit` everywhere, enforcement scripts (AC5, AC6, AC8)          |
| `just test`            | layers 1+2 for files changed since `origin/main` merge-base (or since HEAD without an upstream)  |
| `just test-unit`       | layer 1, all of `apps/*` and `packages/*`                                                        |
| `just test-browser`    | layer 2, real Chromium via Playwright, MSW service worker                                        |
| `just server -D`       | detached supervisor: mock server → `next build` → `next start`; stops itself after `PC_TTL`s     |
| `just http <url>`      | loopback probe via curl inside a recipe (agent shells deny bare `curl`)                          |
| `just install`         | `CI=true pnpm install --frozen-lockfile`; `just install-update` after manifest edits             |
| `just test-e2e`        | layer 3 against the running supervisor; exits non-zero within 5s when it is down                 |
| `just test-all`        | wipe `test-results/`, `check`, unit, browser, rebuild + restart supervisor, e2e, print durations |
| `just server-down`     | stop a detached supervisor                                                                       |
| `scripts/verify-ac.sh` | runs SPEC.md AC2–AC9 as executable checks and prints a table (AC1 is the CI job)                 |

Reports land in `test-results/` at the repo root: `unit.json`, `browser.json`, `e2e.json`, plus
screenshots under `browser/` and Playwright artefacts under `e2e/`. Failure screenshots appear in
`browser.json` as `screenshots[]` on the assertion result.

The agent loop contract is `just check && just test` per iteration and `just test-all` before
declaring a task done.

## Agent sandbox requirements

The harness needs one grant beyond repo writes. Everything else, including all external egress,
stays denied.

1. **Bind and connect on `127.0.0.1`, any port.** Mock server (4010), app (3000), process-compose
   control port (8474), plus the ephemeral ports vitest browser mode and Playwright CDP pick.

For Claude Code this is a committed project setting in `.claude/settings.json`:

```json
{
  "sandbox": {
    "network": { "allowLocalBinding": true }
  }
}
```

Without it, phases 2, 6, 7 and 8 fail with `ECONNREFUSED` / `EADDRNOTAVAIL` errors that look like
harness bugs.

Two former grants are gone by design. The test dotenv file is `test.env`, not `.env.test`, so the
usual `.env*` read-deny never matches it; it holds loopback URLs and a placeholder key. On macOS the
sandbox denies the Mach port registration Chromium uses to spawn helpers, so `@repo/test-config`
detects Claude Code (`CLAUDECODE=1`) and launches Chromium with `--single-process`, serialising
browser test files. `CHROMIUM_SINGLE_PROCESS=1|0` overrides the detection; CI and humans never set
it.

Other sandbox behaviour observed while building this repo, in `PROBLEMS.md` and `CLAUDE.md`: no
unix-socket bind in the repo (process-compose therefore uses TCP), no `kill`/`pkill`/bare `curl`
from the agent shell (use `just server-down` and `just http`), GNU sed on PATH. A detached
supervisor stops itself after `PC_TTL` seconds (default 3600).

## Layout

```
apps/web/            Next 16 App Router toy app. app/ has routes only, never tests.
  src/lib/**         logic, unit-tested; lib/supabase/client.ts is the only env/origin read
  src/components/**  client or pure components with *.browser.test.tsx beside them
  e2e/**/*.spec.ts   Playwright, ≤ 20 tests
packages/types       @repo/types: hand-written stand-in for `supabase gen types`
packages/mocks       @repo/mocks: handlers, scenarios, fixtures, auth sessions, loopback server
packages/test-config @repo/test-config: vitest project factories, MSW setup, Playwright config,
                     `authed` fixture, JSON reporter with screenshot paths
scripts/             enforcement scripts run by `just check`, verify-ac.sh, duration report
vitest.config.ts     root harness config: `unit` over apps/* + packages/*, `browser` over apps/web
process-compose.yaml supervisor definition
```

## Copying the spec into another repo

1. Copy `SPEC.md`. Fill the parameters table first; every `> ADAPT:` callout marks where a
   parameter changes mechanics rather than names.
2. Decide `WORKSPACE`. In a `single` workspace, `packages/mocks/src` becomes `src/mocks/`,
   `packages/test-config/src` becomes `test/`, and the factories inline into `vitest.config.ts`.
3. Decide `EXTERNAL_ORIGINS`. One handler module (`handlers/<origin>/{handlers,scenarios,fixtures}.ts`)
   and one client factory (`src/lib/<origin>/client.ts`) per origin. Handler URL patterns stay
   origin-agnostic (`*/rest/v1/...`) so the same array serves all three layers.
4. Decide `AUTH_PROVIDER`. Keep the `anonSession()` / `userSession(user)` contract returning
   `{ handlers, cookies }`. If the app verifies JWTs locally, mint signed test tokens with a
   test-only key pair instead of the unsigned tokens used here.
5. Point `TYPES_SOURCE` at the committed generated types and make `just gen-types` regenerate them.
   Agents never run codegen.
6. Copy `test.env` and set every external-origin env var, server-side and `NEXT_PUBLIC_*`, to
   `http://127.0.0.1:${MOCK_PORT}`. Literal IP, no DNS.
7. Grant the sandbox loopback bind (above).

### What ports as-is

- `packages/test-config` (factories, setup files, Playwright config and fixtures, reporter).
- `packages/mocks/src/server.ts` (loopback server with `/__scenario`, `/__reset`, `/__health`,
  CORS, `Cache-Control: no-store`) and the scenario registry shape.
- `justfile` recipes, `process-compose.yaml`, `scripts/check-*.sh`, `scripts/verify-ac.sh`,
  `.oxlintrc.json` overrides, `.github/workflows/test.yml`.

### What is app-specific

- Everything under `apps/web/src` and `apps/web/e2e`.
- `packages/mocks/src/handlers/<origin>/*` and `packages/mocks/src/auth/*`: rewrite per origin and
  provider, keeping the exported contract.
- `packages/types`.

### Known deviations from SPEC.md

Recorded with reasons in `PROBLEMS.md`. In brief: `test-results/` lives at the repo root because
layer 1 spans `packages/*`; browser-mode context comes from `vitest/browser` (the Vitest 4 path);
the JSON reporter is a thin subclass that adds screenshot paths; `/auth/v1/user` in the mock is
token-aware rather than a static anon 401.
