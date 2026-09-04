<h1 align="center">
  📸
  <br>wtest
</h1>
<p align="center">
   Vitest + Playwright harness for loopback only sandboxed agents
</p>

Proving ground for [`SPEC.md`](./SPEC.md): a three-layer test harness (Vitest node, Vitest browser
mode, Playwright) fed by one set of MSW handlers, with zero network egress. Toy Next.js app
under `apps/web` for validation.

## Run it locally

```sh
direnv allow          # nix devShell: node, pnpm, just, process-compose, oxlint, oxfmt, chromium
pnpm install
```

Everything else goes through `just`. Agents run recipes as `direnv exec . just <recipe>`.

| Recipe                 | Purpose                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `just check`           | oxlint, oxfmt `--check`, `tsc --noEmit` everywhere, enforcement scripts (AC5, AC6, AC8)                                                       |
| `just test`            | layers 1+2 for files changed since `origin/main` merge-base (or since HEAD without an upstream)                                               |
| `just test-unit`       | layer 1, all of `apps/*` and `packages/*`                                                                                                     |
| `just test-browser`    | layer 2, real Chromium via Playwright, MSW service worker                                                                                     |
| `just server -D`       | detached supervisor: mock server → `next build` → `next start`; stops itself after `PC_TTL`s                                                  |
| `just http <url>`      | loopback probe via curl inside a recipe (agent shells deny bare `curl`)                                                                       |
| `just install`         | `CI=true pnpm install --frozen-lockfile`; `just install-update` after manifest edits                                                          |
| `just test-e2e`        | layer 3 against the running supervisor; exits non-zero within 5s when it is down                                                              |
| `just test-all`        | wipe `test-results/`, `check`, unit, browser, rebuild + restart supervisor, e2e, print durations, write gallery; `SCREENSHOTS=all` by default |
| `just report`          | rebuild `test-results/index.html` from the JSON reports and open it                                                                           |
| `just server-down`     | stop a detached supervisor                                                                                                                    |
| `scripts/verify-ac.sh` | runs SPEC.md AC2–AC12 as executable checks and prints a table (AC1 is the CI job)                                                             |

## Agent sandbox requirements

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

## Copying the spec into another repo

1. Copy `SPEC.md`. Fill the parameters table first; every `> ADAPT:` callout marks where a
   parameter changes mechanics rather than names.
2. Copy `test.env` and set every external-origin env var, server-side and `NEXT_PUBLIC_*`, to
   `http://127.0.0.1:${MOCK_PORT}`. Literal IP, no DNS.
3. Grant the sandbox loopback bind (above).
