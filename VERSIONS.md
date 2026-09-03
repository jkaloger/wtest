# Resolved versions

Registry lookup run 2026-09-03 against the `VERIFY` floors in `SPEC.md`. Phase agents pin from this
table rather than re-querying — the sandbox has no egress. Re-run the loop in `PLAN.md` § Human
setup tasks to refresh.

| Package                      | Pin        | Added in phase |
| ---------------------------- | ---------- | -------------- |
| `vitest`                     | `^4.1.11`  | 3              |
| `@vitest/browser-playwright` | `^4.1.11`  | 3              |
| `vitest-browser-react`       | `^2.2.0`   | 3              |
| `msw`                        | `^2.15.0`  | 2              |
| `@mswjs/http-middleware`     | `^0.10.3`  | 2              |
| `next`                       | `^16.3.4`  | 4              |
| `react` / `react-dom`        | `^19.2.8`  | 4              |
| `@supabase/ssr`              | `^0.12.5`  | 4              |
| `@supabase/supabase-js`      | `^2.114.0` | 4              |
| `playwright`                 | `1.61.1`   | 3              |
| `@playwright/test`           | `1.61.1`   | 3              |

Toolchain from the flake, not npm: `oxlint` 1.81.0, `oxfmt` 0.66.0, node 22.23.2, pnpm 11.22.0.

`packageManager` in `package.json` must track `nixpkgs#pnpm`, and `.npmrc` sets
`manage-package-manager-versions=false` — otherwise pnpm tries to fetch the pinned CLI itself on
every invocation, which the agent sandbox has no egress for.

## Playwright is pinned below latest, deliberately

npm latest is 1.62.1; `nixpkgs#playwright-driver.version` on the pinned rev is **1.61.1**. Browsers
come from nix and are never downloaded, so the npm package must match the driver exactly or the
bundled browser executable path resolution breaks. `scripts/check-playwright-version.sh` (phase 9)
compares `node_modules/playwright/package.json` against `$PLAYWRIGHT_VERSION` and fails on drift —
this is AC8.

Both are exact (no caret) and repeated under `overrides:` in `pnpm-workspace.yaml` so no transitive
dep can float them. pnpm 10 no longer reads a `pnpm.overrides` key in `package.json`.

Bumping means bumping the nixpkgs input first, then this table.
