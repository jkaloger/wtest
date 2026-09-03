# Test Harness Spec: Vitest + Browser Mode + Playwright

Portable spec. Copy this file into the adopting repo as `SPEC.md`. Fill the parameters table first; every `> ADAPT:` callout marks where a parameter changes mechanics, not just names. The defaults below describe a pnpm monorepo with one Next.js App Router app; they are a worked example, not a requirement.

## Parameters

| Param              | Default                             | Notes                                                       |
| ------------------ | ----------------------------------- | ----------------------------------------------------------- |
| `FRAMEWORK`        | `next` (App Router)                 | `astro` variant is documented but unproven                  |
| `WORKSPACE`        | `monorepo` (pnpm workspaces)        | `single` = flatten packages into `src/mocks/` + `test/`     |
| `PM`               | `pnpm`                              | Any PM; all commands go through `justfile`                  |
| `SRC_DIR`          | `apps/web/src`                      |                                                             |
| `APP_DIR`          | `apps/web/app`                      | Next routes. No test files here, ever                       |
| `E2E_DIR`          | `apps/web/e2e`                      |                                                             |
| `EXTERNAL_ORIGINS` | `supabase` (`/rest/v1`, `/auth/v1`) | One handler module + one client factory per origin          |
| `AUTH_PROVIDER`    | `supabase-ssr`                      | See Auth fixtures                                           |
| `TYPES_SOURCE`     | `@repo/types` (`packages/types`)    | Where backend row/DTO types live; fixtures import from here |
| `BASE_BRANCH`      | `main`                              | Merge-base for `--changed`                                  |
| `MOCK_PORT`        | `4010`                              | Loopback mock server                                        |
| `APP_PORT`         | `3000`                              | `next start`                                                |
| `PC_PORT`          | `8474`                              | process-compose control channel, TCP on loopback            |
| `PC_TTL`           | `3600`                              | Seconds before a detached supervisor stops itself           |
| `RESULTS_DIR`      | `test-results/` at the repo root    | Layer 1 spans `packages/*`, so reports live above `apps/`   |
| `ENV_FILE`         | `test.env`                          | Loopback URLs + placeholder key. Not `.env.*`: see Sandbox  |
| `CI`               | `github-actions` (ubuntu, nix)      | Any Linux runner with nix + `unshare`                       |

## Objective

Three-layer harness for agent-driven iteration. Sub-second verify loop for logic, warm real-browser component tests, thin page-level Playwright suite. One set of MSW handlers feeds all three. Zero network egress: loopback only.

## Principles

1. **MSW is the only double for HTTP.** `vi.*` permitted only for non-network boundaries: timers, `Date`, `crypto`, env. `vi.mock` banned by lint everywhere; per-file escape `// mock-allow: <reason>` required and greppable. Modules that perform HTTP and `@repo/*` packages may never be `vi.mock`ed.
2. **No fake DOM.** Layer 1 is `node` only. Anything touching DOM or React rendering is layer 2. No jsdom, no happy-dom.
3. **Real browser or pure logic.** Route handlers, server actions, `proxy.ts` are thin wrappers over `lib/` functions. Logic is unit-tested; wiring is e2e.
4. **Unhandled request = failure.** `onUnhandledRequest: 'error'` in every layer. Sandbox (no egress) is the backstop.
5. **Every acceptance criterion is mechanised.** `just check` or a CI job fails; nobody reads.

## Version floors

Minimum majors = latest stable as of Sep 2026. Config below is written against these APIs. `VERIFY` = confirm against npm/nixpkgs when adopting; sandbox blocks the lookup. Record resolved pins in a `VERSIONS.md` beside this spec.

| Package                           | Floor                                           | Why it matters                                                |
| --------------------------------- | ----------------------------------------------- | ------------------------------------------------------------- |
| `vitest`                          | 4 `VERIFY`                                      | `test.projects` (workspace file removed), provider packages   |
| `@vitest/browser-playwright`      | matches vitest                                  | Browser provider split out of `@vitest/browser`               |
| `vitest-browser-react`            | latest `VERIFY`                                 | `render`, `renderHook`                                        |
| `msw`                             | 2 `VERIFY`                                      | `http`/`HttpResponse` API                                     |
| `@mswjs/http-middleware`          | latest `VERIFY`                                 | Loopback mock server                                          |
| `next`                            | 16 `VERIFY`                                     | `proxy.ts` on Node runtime; static prerender fetches at build |
| `react`                           | 19                                              |                                                               |
| `node`                            | current LTS                                     | From flake                                                    |
| `playwright` / `@playwright/test` | = `playwright-driver.version` in pinned nixpkgs | Exact pin, checked by `just check`                            |
| `oxlint`, `oxfmt`                 | latest `VERIFY`                                 | oxfmt falls back to prettier if absent in nixpkgs             |

## Layout

```
apps/web/
  app/                         Next routes. NO TESTS. Never imported by any vitest test.
  src/
    components/button/
      index.tsx
      button.test.ts           layer 1 (pure helpers only)
      button.browser.test.tsx  layer 2
    lib/<origin>/client.ts     the ONLY place an external origin URL is read (env)
    lib/**                     logic extracted from routes/actions, unit-tested here
  e2e/**/*.spec.ts             layer 3
  public/mockServiceWorker.js  committed, from `<pm> exec msw init apps/web/public/`
  vitest.config.ts             composes @repo/test-config factories
  playwright.config.ts         composes @repo/test-config factory
  vitest.config.ts             IDE runs only; the root config is the harness entry
packages/mocks/                @repo/mocks
  src/handlers/<origin>/handlers.ts    happy-path handler array
  src/handlers/<origin>/scenarios.ts   named override helpers
  src/handlers/<origin>/fixtures.ts    typed row builders (types from TYPES_SOURCE)
  src/handlers/index.ts                aggregate `handlers`
  src/auth/index.ts                    anonSession(), userSession(user)
  src/node.ts                          setupServer(...handlers)
  src/browser.ts                       setupWorker(...handlers)
  src/server.ts                        loopback mock server (layer 3)
packages/test-config/          @repo/test-config
  src/vitest.ts                unitProject(), browserProject()
  src/playwright.ts            playwrightConfig(), `authed` fixture, mainAlert(page)
  src/chromium.ts              single-process Chromium detection (macOS agent sandbox)
  src/reporter.ts              vitest JsonReporter subclass adding screenshots[] per assertion
  src/setup/unit.ts  src/setup/browser.ts
packages/types/                @repo/types: committed generated backend types
test-results/                  RESULTS_DIR: unit.json browser.json e2e.json, browser/ e2e/ artefacts
vitest.config.ts               root: `unit` project over apps/* + packages/*, `browser` over apps/web
justfile  flake.nix  process-compose.yaml  test.env  CLAUDE.md (agent gotchas)
```

Rules:

- Tests colocate inside the module dir of their subject. Never under `app/`, never in `__tests__/`, never in a top-level `tests/`.
- File patterns: unit `**/*.test.{ts,tsx}` excluding `**/*.browser.test.*`; browser `**/*.browser.test.tsx`; e2e `e2e/**/*.spec.ts`. `.spec.ts` is reserved for Playwright.
- Handler URL patterns are origin-agnostic: `http.get('*/rest/v1/profiles', …)`. Same array serves all three layers.

> ADAPT: `WORKSPACE=single` → `packages/mocks/src` becomes `src/mocks/`, `packages/test-config/src` becomes `test/`, factories are inlined into `vitest.config.ts`.

## Layer 1: unit (node)

- Vitest project `unit`. Environment `node`. No DOM environment available.
- Covers: `lib/**`, data transforms, query builders, zod schemas, extracted server-action/route logic, `packages/*`.
- MSW via `@repo/mocks/node` in `setup/unit.ts`:
  ```ts
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  ```
- Per-test override: `server.use(...supabase.scenario.serverError('profiles'))`. Module-level `use` banned.

## Layer 2: component (vitest browser mode)

- Vitest project `browser`. Factory output:
  ```ts
  {
    name: 'browser',
    include: ['**/*.browser.test.tsx'],
    setupFiles: ['@repo/test-config/setup/browser'],
    browser: {
      enabled: true,
      provider: playwright(),          // @vitest/browser-playwright
      instances: [{ browser: 'chromium' }],
      headless: true,
      screenshotFailures: true,
      screenshotDirectory: 'test-results/browser',
    },
  }
  ```
- Render with `render()` / `renderHook()` from `vitest-browser-react`. Interact via `page`, `userEvent` from `vitest/browser` (Vitest 4 re-export; `@vitest/browser/context` is banned by lint to avoid a direct `@vitest/browser` dep). Real CDP input. Assert via `expect.element(locator)`; locators auto-retry, no manual waits.
- Env: vitest does not forward `test.env` into the browser's `process.env` shim. The factory mirrors Next's inlining and injects every key via vite `define` (`process.env.KEY` → literal). Loopback test values only.
- Vite 8 (vitest 4) transforms JSX with oxc, not esbuild: configure `oxc.jsx.runtime`, never `esbuild.jsx`.
- macOS agent sandboxes deny the Mach port registration Chromium uses to spawn helpers (`MachPortRendezvousServer: Permission denied`). `singleProcess()` in `@repo/test-config` returns true when `CHROMIUM_SINGLE_PROCESS=1`, or when unset and `platform === "darwin"` with `CLAUDECODE=1`; then Chromium launches with `--single-process` and the browser project sets `fileParallelism: false`. `CHROMIUM_SINGLE_PROCESS=0` forces multi-process. CI and humans never see the flag.
- MSW via `@repo/mocks/browser` service worker started in `setup/browser.ts` with `onUnhandledRequest: 'error'`; `afterEach(() => worker.resetHandlers())`. Worker routes requests per iframe, so parallel files do not leak overrides. Override per-test via `worker.use(...scenario)`.
- Server components are out of scope here. Components under `src/components/**` are client or pure, never `async`. Anything in `app/` is e2e. Enforced: lint bans imports from `app/` in test files.

> ADAPT: existing RTL suites. Run them inside browser mode unchanged (`@testing-library/react` works there). Delete jsdom stubs (`matchMedia`, `IntersectionObserver`). Migrate to `vitest-browser-react` locators opportunistically. Lint bans new files importing `@testing-library/*`.

RTL → browser-mode equivalence: `render` → `render`; `screen.getBy*` → locator `getBy*`; `userEvent` → `userEvent` (real); `renderHook` → `renderHook`; `waitFor`/`findBy*` → unnecessary; jest-dom matchers → `expect.element()` built-ins.

> ADAPT: `FRAMEWORK=astro` (unproven). Add project `unit-astro` using `getViteConfig()` for Container API render-to-string tests. Islands are React; test in layer 2 unchanged.

## Layer 3: page-level (Playwright, thin)

- Separate `playwright.config.ts` from `playwrightConfig()` factory. Not a vitest project.
- Scope: routing, `proxy.ts` auth redirects, server actions end-to-end, one smoke test per top-level route. Hard cap 20 tests. Anything component-shaped moves to layer 2.
- Config: `reporter: [['line'], ['json', { outputFile: 'test-results/e2e.json' }]]`, `outputDir: 'test-results/e2e'`, `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, `video: 'off'`, `maxFailures: 3`, `workers: 1`, `fullyParallel: false`. No `webServer` block: the supervisor owns the server.
- **Interception = loopback mock server**, not in-process MSW. `@repo/mocks/server` = express + `@mswjs/http-middleware(handlers)` + `POST /__scenario { origin, name, args }` + `POST /__reset` + `GET /__health`. Responses carry `Cache-Control: no-store`.
  - Every external-origin env var, server-side and `NEXT_PUBLIC_*`, points at `http://127.0.0.1:${MOCK_PORT}` in `ENV_FILE`. Literal IP, no DNS.
  - Mock server must be up before `next build`: static prerender fetches hit it.
  - Browser-side calls hit the same server. No service worker, no `page.route` in e2e.
  - `beforeEach`: `POST /__reset`. Overrides: `POST /__scenario`.
  - App code is unaware. No `instrumentation.ts`, no test build, one artefact for prod and e2e.
- e2e-covered routes must not use `force-cache` / `revalidate` on external fetches; scenario switches would not apply.
- Next's `<next-route-announcer>` carries `role="alert"`, so page-level `getByRole("alert")` is ambiguous. Specs use `mainAlert(page)` from `@repo/test-config/playwright`, scoped to `main`.
- Under `singleProcess()` Chromium dies when a context closes, so the fixture shares one worker-scoped context and clears cookies per test. Multi-process keeps Playwright's per-test context.

> ADAPT: `FRAMEWORK=astro` → `astro build` + `astro preview` with Node adapter, same loopback server.

## Mocks package

- `handlers/<origin>/handlers.ts`: happy path, fixture-backed. `scenarios.ts`: `notFound(resource)`, `serverError(resource)`, `slow(resource, ms)`, `empty(resource)`, each returns a handler array. `fixtures.ts`: builders typed from `TYPES_SOURCE`, e.g. `profile({ id })`.
- `@mswjs/data` is out of scope.
- Types: agents never run codegen. `just gen-types` is a human setup-phase command (network). Generated output committed in `TYPES_SOURCE`. Drift check runs in CI only.

## Auth fixtures

Contract, provider-agnostic: `anonSession()` and `userSession(user)` from `@repo/mocks/auth`, each returning `{ handlers, cookies }`.

- Layers 1–2: `use(...userSession(u).handlers)`.
- Layer 3: `authed` fixture in `@repo/test-config` does `POST /__scenario auth.user(u)` then `context.addCookies(userSession(u).cookies)`. Anon is default. Exactly one smoke test drives the login flow through mocked `/auth/v1/token`.

Supabase example: handlers mock `/auth/v1/user` and `/auth/v1/token`. `/auth/v1/user` decodes the bearer token the mock itself issued, so a sign-in followed by `getUser()` succeeds without a scenario; `anonSession()` forces 401 even with a token. Cookie is a well-formed, unsigned `sb-<ref>-auth-token`. `@supabase/ssr` derives `<ref>` from the URL hostname, so under loopback it is `sb-127-auth-token`; the fixture computes the name the same way.

> ADAPT: app verifies JWTs locally (`getClaims`, asymmetric keys) → mint signed test JWTs with a test-only key pair in `@repo/mocks/auth`.

## Commands (justfile, PM-agnostic)

Recipe names use `-`, not `:`. `just` parses recipe names as identifiers, so `test:unit` is a syntax error.

| Recipe           | Behaviour                                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `test`           | layers 1+2, `--changed=$(git merge-base HEAD origin/$BASE_BRANCH)`; no upstream → `--changed`. `passWithNoTests: true` here only |
| `test-unit`      | layer 1 full; fails on zero tests                                                                                                |
| `test-browser`   | layer 2 full; fails on zero tests                                                                                                |
| `test-e2e`       | layer 3; requires server up (`GET /__health` + app health), fails fast otherwise; stale `.next` accepted                         |
| `test-all`       | wipe `RESULTS_DIR`, `check`, layers 1+2 full, rebuild + restart server, layer 3, print durations                                 |
| `server`         | `process-compose up`: mock-server → `next build` → `next start` (+ `watchdog`), readiness probes; `-D` detaches                  |
| `server-restart` | `server-down`, `server -D`, `server-wait`; what `test-all` uses                                                                  |
| `server-wait`    | block until both health checks pass or `next build` fails (default 180s)                                                         |
| `server-down`    | stop a detached supervisor                                                                                                       |
| `server-status`  | health checks, exit code, bounded to 5s                                                                                          |
| `server-logs`    | `process-compose process logs <name>`                                                                                            |
| `http`           | `curl -fsS --max-time 5 <url>`; agent shells may deny bare `curl`, recipes run it fine                                           |
| `check`          | oxlint, oxfmt `--check` (or prettier), `tsc --noEmit` (tests included), enforcement scripts (see Lint rules)                     |
| `fmt`            | oxfmt (or prettier) write                                                                                                        |
| `install`        | `CI=true <pm> install --frozen-lockfile`; `install-update` drops `--frozen-lockfile` after manifest edits                        |
| `gen-types`      | regenerate `TYPES_SOURCE`; human, network, outside sandbox                                                                       |

Agent loop contract: per iteration `just check && just test`. At task completion `just test-all`. Agents never run `gen-types`. Agents start the supervisor detached (`server -D` or `server-restart`) and stop it with `server-down`; the `watchdog` process stops it after `PC_TTL` seconds regardless, so a forgotten supervisor never outlives a session. `kill`/`pkill` are not part of the contract: agent shells commonly deny them.

Supervisor = `process-compose` from nixpkgs, declared in `process-compose.yaml`. No daemon, no custom code. Control channel is TCP on `127.0.0.1:${PC_PORT}`: sandboxes deny unix sockets inside the repo.

## Sandbox / offline

- Loop passes with zero egress. CI job: `unshare -Urn -- sh -c 'ip link set lo up && nix develop -c just test-all'`; fallback `--network=none` container.
- macOS has no network namespace. Locally rely on `onUnhandledRequest: 'error'` plus the agent sandbox.
- Setup phase, outside sandbox: `just gen-types`, `direnv allow` + one directory entry to populate `.direnv/`. Browsers come from nix, never `playwright install`. `just install` runs inside the sandbox when its proxy admits the registry (Claude Code does), otherwise it is a human step too; the lockfile diff is always human-reviewed.
- Agents run recipes as `direnv exec . just <recipe>`, never `nix develop`. nix-direnv caches the devShell to `.direnv/flake-profile-<hash>.rc`; on a cache hit nothing invokes nix, so the agent sandbox can keep the nix daemon socket and nix cache writes denied. A stale cache fails loudly instead of running the wrong toolchain. The direnv shell hook is `precmd`-only and never fires in an agent's non-interactive shell, hence the explicit `exec`.
- Package manager must not self-manage its own version: nix pins it, so disable the `packageManager`-field fetch (`manage-package-manager-versions=false` for pnpm). Otherwise every recipe attempts egress before it runs.
- Agent sandbox must permit exactly one thing beyond repo writes: **bind and connect on `127.0.0.1`, any port** (mock server, app server, process-compose control port, and the ephemeral ports vitest browser mode and Playwright CDP choose at runtime — a loopback listener is unreachable off-host, so this is not egress). Real dotenv files and all external egress stay denied.
- `ENV_FILE` is `test.env`, not `.env.test`: agent sandboxes deny `.env*` reads (and even shell commands naming such a file), and this file holds nothing secret. `just` loads it with `dotenv-load`; `loadTestEnv()` finds it for bare `vitest` and IDE runs. process-compose runs with `--disable-dotenv` and inherits env from `just`.
- Agent shells also tend to deny `kill`, `pkill`, bare `curl`, and `sed -i` behaves as GNU sed. The harness routes around all four: supervisor lifecycle via recipes + watchdog, probes via `just http`, in-place edits via `perl -pi -e`. Record such findings in the repo's `CLAUDE.md`, not in tribal memory.
- Flake: `playwright-driver.browsers` (chromium only), exports `PLAYWRIGHT_BROWSERS_PATH`, `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true`, `PLAYWRIGHT_VERSION=${playwright-driver.version}`, `NEXT_TELEMETRY_DISABLED=1`, `ASTRO_TELEMETRY_DISABLED=1`. `package.json` pins `playwright` and `@playwright/test` exactly to that version; `just check` fails on mismatch.
- `next/font/google` fetches at build → use `next/font/local`.

## Output contract for agents

- `RESULTS_DIR/unit.json`, `RESULTS_DIR/browser.json` (vitest `--reporter=default --reporter=@repo/test-config/reporter --outputFile`), `RESULTS_DIR/e2e.json`. Wiped at the start of every `test*` recipe. The reporter subclasses vitest's `JsonReporter` because the stock one omits artefacts; it adds `screenshots[]` to each failed assertion.
- Screenshots: `test-results/browser/<file>/<test>.png` (vitest scheme), `test-results/e2e/<spec>-<test>/…` (Playwright scheme). Paths appear in the JSON reports.
- Exit codes are the sole pass/fail signal. No prompts, no watch mode in agent-invoked recipes.
- Timing targets are soft, measured on CI from report durations and printed by `test-all`: unit full < 5s, `--changed` < 1s, browser cold < 10s, warm single file < 3s, e2e < 60s. No timing gate fails a run.

## Lint rules (oxlint, run by `check`)

| Scope                                 | Rule                                                                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `**/*.test.*`, `**/*.browser.test.*`  | `no-restricted-imports`: anything under `APP_DIR`; `@playwright/test`; `@testing-library/*` (new files); `@vitest/browser/context` |
| `E2E_DIR/**`                          | `no-restricted-imports`: `vitest`, `vitest-browser-react`, `@testing-library/*`, `SRC_DIR/components/**`                           |
| everywhere                            | `vi.mock` banned unless file has `// mock-allow: <reason>`                                                                         |
| `APP_DIR/**`                          | no files matching test globs                                                                                                       |
| `SRC_DIR/**` except `lib/*/client.ts` | script: no `https?://` literals outside allowlist                                                                                  |
| `pnpm-workspace.yaml`                 | script: no pnpm `allowBuilds` placeholder (`set this to true or false`)                                                            |
| `node_modules/playwright`             | script: version equals `PLAYWRIGHT_VERSION`                                                                                        |

## Acceptance criteria

All mechanised. "Passes" = exit 0.

1. Fresh clone, setup phase done, then `unshare -Urn -- nix develop -c just test-all` passes in CI.
2. A browser-mode test whose component queries an external origin passes with the happy-path handlers and fails with an unhandled-request error when that handler is removed.
3. Editing one component file and running `just test` runs only test files whose import graph includes it. Soft: < 5s warm.
4. A deliberately failing browser-mode test writes a PNG under `test-results/browser/` and its path appears in `test-results/browser.json`.
5. `just check` fails if `@playwright/test` is imported outside `E2E_DIR`, if `E2E_DIR` imports vitest or components, or if any test file exists under `APP_DIR`.
6. `just check` fails if an `https?://` literal exists in `SRC_DIR` outside `lib/*/client.ts` and the allowlist.
7. `next build` completes with the mock server up and no egress; e2e smoke tests pass against `next start` with all origin env vars set to `127.0.0.1`.
8. `just check` fails if `playwright` in `node_modules` differs from `PLAYWRIGHT_VERSION`.
9. `just test-e2e` exits non-zero within 5s when the server is not running.
10. `PC_TTL=5 just server -D` on a spare `PC_PORT` is gone within 15s without `server-down`.

## Out of scope

Coverage. `@mswjs/data`. Signed JWTs (unless ADAPT triggered). Visual regression. Astro proof.
