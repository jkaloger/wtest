## Summary

Build this repo out as the proving ground for `SPEC.md`. Spec is the source of truth for every decision; this doc only sequences the work. Decision rationale lives in `.hydra/spec-precision.json` (`hydra show <slug>`).

Each phase = one agent iteration. Phase ends green on its own verify command before the next starts. No phase touches a later phase's files.

## Rules for the building agent

- Read `SPEC.md` fully before phase 0. Params table defaults apply.
- Sandbox: no egress. Anything needing network (installs, codegen, version lookups) is a **human setup task**, listed below. Stop and ask when you hit one.
- No `vi.mock`, no jsdom/happy-dom, no tests under `app/`, no hardcoded origins. Lint enforces from phase 9; behave as if it did from phase 0.
- Toy app exists only to exercise the harness. Keep it minimal: one table (`profiles`), three routes, one server action.
- Every phase's verify command must be runnable by the agent inside `nix develop`.

## Human setup tasks (outside sandbox)

1. Verify version floors marked `VERIFY` in SPEC.md; record exact versions in `package.json` pins:
   ```sh
   for p in vitest @vitest/browser-playwright vitest-browser-react msw @mswjs/http-middleware next react @playwright/test playwright @supabase/ssr @supabase/supabase-js oxlint oxfmt; do printf '%-28s ' $p; npm view $p version; done
   nix eval --raw nixpkgs#playwright-driver.version
   ```
2. After phase 0: `nix develop` once (fetches toolchain + chromium), `pnpm install`.
3. After every phase that adds deps: `pnpm install`, commit lockfile.
4. Phase 1 types: real `supabase gen types` needs a project; PoC uses a hand-written file in gen-output shape. Note this in the file header.

## Phases

### Phase 0 — Skeleton + toolchain

Files: `flake.nix`, `flake.lock`, `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`, `justfile`, `.gitignore`, `.env.test`, `.envrc` (optional).

- Flake devShell: node LTS, pnpm, just, process-compose, oxlint, oxfmt (fallback prettier), `playwright-driver.browsers` chromium-only. Exports `PLAYWRIGHT_BROWSERS_PATH`, `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true`, `PLAYWRIGHT_VERSION`, `NEXT_TELEMETRY_DISABLED=1`, `ASTRO_TELEMETRY_DISABLED=1`.
- Workspace: `apps/*`, `packages/*`.
- justfile: all recipes from SPEC.md present; unimplemented ones `exit 1` with message.
- `.env.test`: `MOCK_PORT=4010`, `SUPABASE_URL=http://127.0.0.1:4010`, `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4010`, anon key placeholder.

Verify: `nix develop -c just check` exits 0 on empty tree (oxlint + tsc over nothing).

### Phase 1 — `packages/types`

`@repo/types`: `src/supabase.ts` exporting `Database` in `supabase gen types` shape with `public.Tables.profiles` (`id uuid`, `username text`, `display_name text | null`, `created_at timestamptz`). Header comment: hand-written PoC stand-in; regenerate via `just gen-types`.

Verify: `pnpm -F @repo/types tsc --noEmit`.

### Phase 2 — `packages/mocks`

Depends: 1.

`@repo/mocks` per SPEC.md Mocks package + Auth fixtures:

- `handlers/supabase/{handlers,scenarios,fixtures}.ts`, origin-agnostic patterns (`*/rest/v1/profiles`, `*/auth/v1/user`, `*/auth/v1/token`). PostgREST subset: `select`, `eq.<id>` filter, `Prefer: return=representation` on insert.
- `scenarios`: `notFound`, `serverError`, `slow`, `empty`.
- `auth/index.ts`: `anonSession()`, `userSession(user)` → `{ handlers, cookies }`; cookie name derived from `new URL(SUPABASE_URL).hostname.split('.')[0]`.
- `node.ts`, `browser.ts`, `handlers/index.ts`.
- `server.ts`: express + `@mswjs/http-middleware` + `/__scenario`, `/__reset`, `/__health`; `Cache-Control: no-store`. Bin: `mocks-server`.
- Package's own layer-1 tests: handlers respond as fixtures say; scenario override works; unhandled → error.

Verify: `pnpm -F @repo/mocks test` (plain vitest, node) green; `pnpm -F @repo/mocks start & curl 127.0.0.1:4010/__health`.

### Phase 3 — `packages/test-config`

Depends: 2.

- `vitest.ts`: `unitProject(opts)`, `browserProject(opts)` per SPEC.md config blocks; JSON reporter output paths; screenshot dir.
- `setup/unit.ts`, `setup/browser.ts`: MSW lifecycle exactly as spec.
- `playwright.ts`: `playwrightConfig(opts)` + `test` extended with `authed` fixture (POST `/__scenario`, `addCookies`).

Verify: `pnpm -F @repo/test-config tsc --noEmit`.

### Phase 4 — Toy Next app

Depends: 3.

`apps/web`, Next 16 App Router, `proxy.ts`.

- `src/lib/supabase/client.ts`: `serverClient()` (`@supabase/ssr` + cookies), `browserClient()`. Only place `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` is read.
- `src/lib/profiles/{queries,transform}.ts`: query builder fn taking a client, `toDisplayName(profile)`.
- `src/lib/auth/actions.ts`: `signIn(formData)` server action → thin wrapper over `lib/auth/sign-in.ts`.
- `src/components/profile-card/index.tsx` (pure, props), `src/components/profile-search/index.tsx` (client, fetches via `browserClient()` on input).
- Routes: `/` static public; `/login` renders form → `signIn`; `/dashboard` RSC, authed, fetches profiles via `serverClient()`. `proxy.ts` redirects anon `/dashboard` → `/login`.
- `next/font/local` only. `vitest.config.ts` + `playwright.config.ts` compose factories.
- `pnpm exec msw init apps/web/public/` committed.

Verify: `pnpm -F web tsc --noEmit`; `just check`.

### Phase 5 — Layer 1 tests in app

Depends: 4.

`lib/profiles/*.test.ts`, `lib/auth/sign-in.test.ts` using `@repo/mocks/node` via setup. At least one test uses a scenario override.

Verify: `just test:unit` green; `test-results/unit.json` exists.

### Phase 6 — Layer 2 tests

Depends: 4.

- `profile-card/profile-card.browser.test.tsx`: render, `expect.element`.
- `profile-search/profile-search.browser.test.tsx`: types into input, asserts fixture rows; second test uses `worker.use(...serverError)` and asserts error UI.
- `src/components/__demo__/fail.browser.test.tsx` guarded by `process.env.DEMO_FAIL === '1'` — used by AC4 verification only.

Verify: `just test:browser` green; `DEMO_FAIL=1 just test:browser` exits non-zero and writes PNG under `test-results/browser/`.

### Phase 7 — Server supervisor

Depends: 4.

- `process-compose.yaml`: `mock-server` (readiness `/__health`) → `next-build` (depends on mock-server healthy, runs once) → `next-start` (readiness `GET /`). Env from `.env.test`.
- `just server`, `just server-status`, `just test:e2e` fail-fast gate (health check, 5s).

Verify: `just server` in background; `just server-status` exits 0; `next build` log shows no failed fetches; `curl 127.0.0.1:3000/` 200.

### Phase 8 — Layer 3 tests

Depends: 3, 7.

`e2e/`: `smoke.spec.ts` (one per route), `auth-redirect.spec.ts` (anon `/dashboard` → `/login`), `login.spec.ts` (form → mocked `/auth/v1/token` → `/dashboard`), `dashboard.spec.ts` (`authed` fixture, `/__scenario serverError` → error state). ≤ 20 tests total.

Verify: server up, `just test:e2e` green; `test-results/e2e.json` exists.

### Phase 9 — Lint + enforcement in `check`

Depends: 4, 8.

- `.oxlintrc.json` with overrides per SPEC.md Lint rules table.
- `scripts/check-vi-mock.sh`: `vi.mock(` without `// mock-allow:` → fail.
- `scripts/check-origins.sh`: `https?://` literals in `apps/web/src` outside `lib/*/client.ts` + allowlist → fail.
- `scripts/check-playwright-version.sh`: `node_modules/playwright/package.json` vs `$PLAYWRIGHT_VERSION`.
- `scripts/check-test-placement.sh`: test globs under `app/` → fail.
- `just check` runs all + oxfmt `--check` + `tsc --noEmit` (tests included; `e2e/tsconfig.json` separate).

Verify: `just check` green; each script fails on a planted violation (add + revert in the iteration, don't commit violations).

### Phase 10 — `test`, `test:all`, AC script

Depends: 5, 6, 8, 9.

- `just test`: merge-base logic + fallback per spec; `passWithNoTests` only here.
- `just test:all`: wipe `test-results/`, `check`, unit, browser, `process-compose` rebuild+restart, e2e, print durations from JSON.
- `scripts/verify-ac.sh`: runs AC1–AC9 from SPEC.md as executable checks (AC1 delegated to CI), prints table.

Verify: `just test:all` green; `scripts/verify-ac.sh` all pass except AC1 (CI).

### Phase 11 — CI

Depends: 10.

`.github/workflows/test.yml`: ubuntu, DeterminateSystems nix installer + magic-nix-cache, `pnpm install --frozen-lockfile` (network phase), then `unshare -Urn -- sh -c 'ip link set lo up && nix develop -c just test:all'`. Upload `test-results/` on failure.

Verify: workflow green on push (human confirms; agent cannot).

### Phase 12 — Adoption README

Depends: 11.

`README.md`: how to run locally, how to copy SPEC.md into another repo (params table walkthrough, ADAPT list), which phases port as-is.

Verify: a second agent follows README against a scratch Next repo and reaches `just test` green (out of scope for this repo; note only).

## Dependency graph

```
0 → 1 → 2 → 3 → 4 → {5, 6, 7}
                      7 → 8
                 {4, 8} → 9
           {5, 6, 8, 9} → 10 → 11 → 12
```

## Done when

`scripts/verify-ac.sh` passes AC2–AC9 locally and CI passes AC1 on a fresh clone.
