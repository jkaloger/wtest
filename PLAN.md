## Summary

Build this repo out as the proving ground for `SPEC.md`. Spec is the source of truth for every decision; this doc only sequences the work. Decision rationale lives in `.hydra/spec-precision.json` (`hydra show <slug>`).

Each phase = one agent iteration. Phase ends green on its own verify command before the next starts. No phase touches a later phase's files.

## Rules for the building agent

- Read `SPEC.md` fully before phase 0. Params table defaults apply.
- Sandbox: no egress by design. In practice the agent sandbox's filtering proxy admits the npm registry (PROBLEMS.md), so `just install` runs from inside the loop; the lockfile diff is still human-reviewed. Codegen and version lookups remain **human setup tasks**, listed below. Stop and ask when you hit one.
- No `vi.mock`, no jsdom/happy-dom, no tests under `app/`, no hardcoded origins. Lint enforces from phase 9; behave as if it did from phase 0.
- Toy app exists only to exercise the harness. Keep it minimal: one table (`profiles`), three routes, one server action.
- Every phase's verify command runs as `direnv exec . <cmd>`. Agents never invoke `nix` directly — the daemon socket is outside the agent sandbox, and nix-direnv's cached `.direnv/flake-profile-*.rc` needs no daemon.
- Recipe names use `-`, not `:`: `just` recipe names are identifiers, so `test:unit` is a parse error. `test-unit`, `test-browser`, `test-e2e`, `test-all`.

## Agent sandbox requirements

One grant, honored from committed project settings (`.claude/settings.json`). Everything else stays denied, including all external egress.

1. **Bind and connect on `127.0.0.1`, any port.** Mock server 4010, `next start` 3000, process-compose control port 8474, plus ephemeral ports vitest browser mode and Playwright CDP pick at runtime. A loopback listener is unreachable off-host, so this grants no egress.

```json
{
  "sandbox": {
    "network": { "allowLocalBinding": true }
  }
}
```

Phase 13 removed two earlier grants: `test.env` (formerly `.env.test`) no longer matches the `.env*` read-deny, and `@repo/test-config` auto-detects Claude Code on macOS (`CLAUDECODE=1`) to launch Chromium with `--single-process`. Neither sandbox key can disable isolation wholesale: `network.strictAllowlist` and `filesystem.disabled` are ignored when set from project settings, by design.

Deliberately _not_ granted: nix daemon socket, `~/.cache/nix` and `~/.local/state/nix` writes, npm registry egress (the Claude Code proxy happens to admit it; nothing depends on that).

## Human setup tasks (outside sandbox)

1. ~~Verify version floors marked `VERIFY` in SPEC.md~~ — done, resolved pins recorded in `VERSIONS.md`. Phase agents pin from that table instead of querying the registry. Re-run to refresh:
   ```sh
   for p in vitest @vitest/browser-playwright vitest-browser-react msw @mswjs/http-middleware next react @playwright/test playwright @supabase/ssr @supabase/supabase-js oxlint oxfmt; do printf '%-28s ' $p; npm view $p version; done
   nix eval --raw nixpkgs#playwright-driver.version
   ```
2. After phase 0: `direnv allow`, then enter the directory once. Populates `.direnv/` (fetches toolchain + chromium, needs daemon + network) and roots the store paths against `nix-collect-garbage`. Then `pnpm install`.
3. After every phase that adds deps: agent runs `just install-update`; human reviews and commits the lockfile diff.
4. After any `flake.nix` / `flake.lock` edit: re-enter the directory. The stale cache makes `direnv exec` call nix, which the agent sandbox denies — the agent fails loudly rather than running on a stale toolchain.
5. Phase 1 types: real `supabase gen types` needs a project; PoC uses a hand-written file in gen-output shape. Note this in the file header.

## Phases

### Phase 0 — Skeleton + toolchain — DONE

Files: `flake.nix`, `flake.lock`, `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`, `tsconfig.json`, `justfile`, `.gitignore`, `test.env`, `.envrc`, `VERSIONS.md`.

- Flake devShell: node LTS, pnpm, just, process-compose, oxlint, oxfmt (fallback prettier), `playwright-driver.browsers` chromium-only. Exports `PLAYWRIGHT_BROWSERS_PATH`, `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true`, `PLAYWRIGHT_VERSION`, `NEXT_TELEMETRY_DISABLED=1`, `ASTRO_TELEMETRY_DISABLED=1`.
- Workspace: `apps/*`, `packages/*`.
- justfile: all recipes from SPEC.md present; unimplemented ones `exit 1` with message.
- `test.env` (was `.env.test` until phase 13): `MOCK_PORT=4010`, `SUPABASE_URL=http://127.0.0.1:4010`, `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4010`, anon key placeholder.
- Playwright pinned exact to `nixpkgs#playwright-driver.version` under `overrides:` in `pnpm-workspace.yaml`. pnpm 10 ignores a `pnpm.overrides` key in `package.json`.
- `lint` and `fmt-check` skip when the tree has no source files: oxlint exits 1 on an empty match, and phase 0 has nothing to lint. The guard drops out naturally from phase 1.
- `.npmrc` sets `manage-package-manager-versions=false`. The flake pins pnpm; without this the `packageManager` field makes pnpm fetch its own CLI on every invocation and every recipe dies on the sandbox's missing egress. Keep `packageManager` in sync with `nixpkgs#pnpm`.

Verify: `direnv exec . just check` exits 0 on empty tree (oxlint + tsc over nothing).

### Phase 1 — `packages/types` — DONE

`@repo/types`: `src/supabase.ts` exporting `Database` in `supabase gen types` shape with `public.Tables.profiles` (`id uuid`, `username text`, `display_name text | null`, `created_at timestamptz`). Header comment: hand-written PoC stand-in; regenerate via `just gen-types`.

Verify: `direnv exec . pnpm -F @repo/types tsc --noEmit`.

### Phase 2 — `packages/mocks` — DONE

Depends: 1.

`@repo/mocks` per SPEC.md Mocks package + Auth fixtures:

- `handlers/supabase/{handlers,scenarios,fixtures}.ts`, origin-agnostic patterns (`*/rest/v1/profiles`, `*/auth/v1/user`, `*/auth/v1/token`). PostgREST subset: `select`, `eq.<id>` filter, `Prefer: return=representation` on insert.
- `scenarios`: `notFound`, `serverError`, `slow`, `empty`.
- `auth/index.ts`: `anonSession()`, `userSession(user)` → `{ handlers, cookies }`; cookie name derived from `new URL(SUPABASE_URL).hostname.split('.')[0]`.
- `node.ts`, `browser.ts`, `handlers/index.ts`.
- `server.ts`: express + `@mswjs/http-middleware` + `/__scenario`, `/__reset`, `/__health`; `Cache-Control: no-store`. Bin: `mocks-server`.
- Package's own layer-1 tests: handlers respond as fixtures say; scenario override works; unhandled → error.

Verify: `direnv exec . pnpm -F @repo/mocks test` (plain vitest, node) green; `direnv exec . pnpm -F @repo/mocks start & curl 127.0.0.1:4010/__health`.

### Phase 3 — `packages/test-config` — DONE

Depends: 2.

- `vitest.ts`: `unitProject(opts)`, `browserProject(opts)` per SPEC.md config blocks; JSON reporter output paths; screenshot dir.
- `setup/unit.ts`, `setup/browser.ts`: MSW lifecycle exactly as spec.
- `playwright.ts`: `playwrightConfig(opts)` + `test` extended with `authed` fixture (POST `/__scenario`, `addCookies`).

Verify: `direnv exec . pnpm -F @repo/test-config tsc --noEmit`.

### Phase 4 — Toy Next app — DONE

Depends: 3.

`apps/web`, Next 16 App Router, `proxy.ts`.

- `src/lib/supabase/client.ts`: `serverClient()` (`@supabase/ssr` + cookies), `browserClient()`. Only place `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` is read.
- `src/lib/profiles/{queries,transform}.ts`: query builder fn taking a client, `toDisplayName(profile)`.
- `src/lib/auth/actions.ts`: `signIn(formData)` server action → thin wrapper over `lib/auth/sign-in.ts`.
- `src/components/profile-card/index.tsx` (pure, props), `src/components/profile-search/index.tsx` (client, fetches via `browserClient()` on input).
- Routes: `/` static public; `/login` renders form → `signIn`; `/dashboard` RSC, authed, fetches profiles via `serverClient()`. `proxy.ts` redirects anon `/dashboard` → `/login`.
- `next/font/local` only. `vitest.config.ts` + `playwright.config.ts` compose factories.
- `pnpm exec msw init apps/web/public/` committed.

Verify: `direnv exec . pnpm -F web tsc --noEmit`; `direnv exec . just check`.

### Phase 5 — Layer 1 tests in app — DONE

Depends: 4.

`lib/profiles/*.test.ts`, `lib/auth/sign-in.test.ts` using `@repo/mocks/node` via setup. At least one test uses a scenario override.

Verify: `direnv exec . just test-unit` green; `test-results/unit.json` exists.

### Phase 6 — Layer 2 tests — DONE

Depends: 4.

- `profile-card/profile-card.browser.test.tsx`: render, `expect.element`.
- `profile-search/profile-search.browser.test.tsx`: types into input, asserts fixture rows; second test uses `worker.use(...serverError)` and asserts error UI.
- `src/components/__demo__/fail.browser.test.tsx` guarded by `process.env.DEMO_FAIL === '1'` — used by AC4 verification only.

Verify: `direnv exec . just test-browser` green; `DEMO_FAIL=1 direnv exec . just test-browser` exits non-zero and writes PNG under `test-results/browser/`.

### Phase 7 — Server supervisor — DONE

Depends: 4.

- `process-compose.yaml`: `mock-server` (readiness `/__health`) → `next-build` (depends on mock-server healthy, runs once) → `next-start` (readiness `GET /`). Env from `test.env`.
- `just server`, `just server-status`, `just test-e2e` fail-fast gate (health check, 5s).

Verify: `direnv exec . just server` in background; `direnv exec . just server-status` exits 0; `next build` log shows no failed fetches; `curl 127.0.0.1:3000/` 200.

### Phase 8 — Layer 3 tests — DONE

Depends: 3, 7.

`e2e/`: `smoke.spec.ts` (one per route), `auth-redirect.spec.ts` (anon `/dashboard` → `/login`), `login.spec.ts` (form → mocked `/auth/v1/token` → `/dashboard`), `dashboard.spec.ts` (`authed` fixture, `/__scenario serverError` → error state). ≤ 20 tests total.

Verify: server up, `direnv exec . just test-e2e` green; `test-results/e2e.json` exists.

### Phase 9 — Lint + enforcement in `check` — DONE

Depends: 4, 8.

- `.oxlintrc.json` with overrides per SPEC.md Lint rules table.
- `scripts/check-vi-mock.sh`: `vi.mock(` without `// mock-allow:` → fail.
- `scripts/check-origins.sh`: `https?://` literals in `apps/web/src` outside `lib/*/client.ts` + allowlist → fail.
- `scripts/check-playwright-version.sh`: `node_modules/playwright/package.json` vs `$PLAYWRIGHT_VERSION`.
- `scripts/check-test-placement.sh`: test globs under `app/` → fail.
- `just check` runs all + oxfmt `--check` + `tsc --noEmit` (tests included; `e2e/tsconfig.json` separate).

Verify: `direnv exec . just check` green; each script fails on a planted violation (add + revert in the iteration, don't commit violations).

### Phase 10 — `test`, `test-all`, AC script — DONE

Depends: 5, 6, 8, 9.

- `just test`: merge-base logic + fallback per spec; `passWithNoTests` only here.
- `just test-all`: wipe `test-results/`, `check`, unit, browser, `process-compose` rebuild+restart, e2e, print durations from JSON.
- `scripts/verify-ac.sh`: runs AC1–AC9 from SPEC.md as executable checks (AC1 delegated to CI), prints table.

Verify: `direnv exec . just test-all` green; `scripts/verify-ac.sh` all pass except AC1 (CI).

### Phase 11 — CI — DONE (workflow committed; green run pending human confirmation)

Depends: 10.

`.github/workflows/test.yml`: ubuntu, DeterminateSystems nix installer + magic-nix-cache, `pnpm install --frozen-lockfile` (network phase), then `unshare -Urn -- sh -c 'ip link set lo up && nix develop -c just test-all'`. Upload `test-results/` on failure.

Verify: workflow green on push (human confirms; agent cannot).

### Phase 12 — Adoption README — DONE

Depends: 11.

`README.md`: how to run locally, how to copy SPEC.md into another repo (params table walkthrough, ADAPT list), which phases port as-is, and the agent sandbox config above — an adopter whose agent cannot bind loopback will fail phases 2, 6, 7, 8 with errors that look like harness bugs.

Verify: a second agent follows README against a scratch Next repo and reaches `direnv exec . just test` green (out of scope for this repo; note only).

### Phase 13 — Sandbox friction removal — DONE

Depends: 12. Source: PROBLEMS.md 2026-09-03. Goal: one sandbox grant (loopback), zero per-session human actions, zero ad-hoc workarounds in the agent loop.

- **Chromium auto-detect.** `packages/test-config/src/chromium.ts`: `singleProcess()` honours `CHROMIUM_SINGLE_PROCESS=1|0` when set, else `process.platform === "darwin" && process.env.CLAUDECODE === "1"`. Removes grant 3; nothing to add to `.claude/settings.json`.
- **Rename `.env.test` → `test.env`.** Escapes the `.env*` read-deny glob so the agent can read and edit it; contents are loopback URLs and a placeholder key. Touch: `justfile` `dotenv-filename`, `loadTestEnv` default and doc comments in `packages/test-config/src/vitest.ts`, message in `apps/web/src/lib/supabase/testing.ts`, README/PLAN/SPEC references, `.github/workflows/test.yml` if it names the file. `.gitignore` has no `.env*` glob; file stays committed. Removes grant 2; `allowRead` in `.claude/settings.json` becomes dead (human deletes).
- **Supervisor watchdog.** `process-compose.yaml` gains `watchdog`: `command: sleep ${PC_TTL}`, `availability: { exit_on_end: true }`. `justfile` exports `PC_TTL := env("PC_TTL", "3600")`. Detached supervisor self-terminates; `server-restart` unaffected. Fix stale `server` comment ("Humans only, never agents").
- **Recipes.** `install` (`CI=true pnpm install --frozen-lockfile`), `install-update` (`--no-frozen-lockfile`), `http url` (`curl -fsS --max-time 5 "$url"`; the agent shell denies bare `curl`, recipes are fine).
- **Workspace-yaml check.** `scripts/check-workspace-yaml.sh`: fail if `pnpm-workspace.yaml` contains pnpm's `set this to true or false` placeholder. Wire into `enforce`.
- **Lint.** `.oxlintrc.json`: `no-restricted-imports` for `@vitest/browser/context` in test files, message "import from vitest/browser".
- **e2e helper.** `packages/test-config/src/playwright.ts` exports `mainAlert(page)` = `page.getByRole("main").getByRole("alert")`; specs use it instead of bare `getByRole("alert")` (Next's route announcer has `role="alert"`).
- **AC10.** `scripts/verify-ac.sh`: `PC_TTL=5 just server -D` on a spare `PC_PORT`; supervisor gone within 15s.
- **Agent docs.** Repo `CLAUDE.md`: PLAN.md is the plan of record (not lazyspec-backed, deliberate); GNU sed on PATH → `perl -pi -e`; no `kill`/`pkill`/bare `curl` in the agent shell → `just server-down` / `just http`; `just install`; `direnv exec . just <recipe>`. PROBLEMS.md: add a status per entry (`fixed` / `human` / `doc`), keep as dated log.
- **Sandbox docs.** README and this file's sandbox section: one grant, loopback bind. `.claude/settings.json` target is `{ "sandbox": { "network": { "allowLocalBinding": true } } }` (human edit).

Verify: `direnv exec . just check` green; with `CHROMIUM_SINGLE_PROCESS` unset in the agent env, `direnv exec . just test-all` green; `PC_TTL=5 PC_PORT=8475 direnv exec . just server -D` then `sleep 15; process-compose process list -p 8475` fails (supervisor gone); `scripts/verify-ac.sh` AC2–AC10 pass; `grep -rn "env[.]test" --exclude-dir=node_modules .` returns only PROBLEMS.md history.

Human after phase 13: delete `filesystem.allowRead` from `.claude/settings.json`; optionally trust the proxy CA for `gh` (`SSL_CERT_FILE`) so the agent can `gh run watch` and close out phase 11's pending verification.

## Dependency graph

```
0 → 1 → 2 → 3 → 4 → {5, 6, 7}
                      7 → 8
                 {4, 8} → 9
           {5, 6, 8, 9} → 10 → 11 → 12 → 13
```

## Done when

`scripts/verify-ac.sh` passes AC2–AC10 locally and CI passes AC1 on a fresh clone.
