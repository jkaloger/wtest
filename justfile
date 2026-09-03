set shell := ["bash", "-euo", "pipefail", "-c"]
set dotenv-filename := ".env.test"
set dotenv-load := true

base_branch := env("BASE_BRANCH", "main")
mock_port := env("MOCK_PORT", "4010")
export APP_PORT := env("APP_PORT", "3000")
pc_port := env("PC_PORT", "8474")
results := "test-results"

_default:
    @just --list

# ---------------------------------------------------------------------------
# check / fmt
# ---------------------------------------------------------------------------

# oxlint, format check, typecheck, plus the SPEC.md enforcement scripts (AC5, AC6, AC8).
check: lint fmt-check typecheck enforce

# oxlint exits 1 when it matches zero files, which is the state until phase 1.
lint:
    @files=$(git ls-files -co --exclude-standard '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs'); \
    if [ -z "$files" ]; then echo "lint: no source files yet"; else oxlint --deny-warnings .; fi

fmt-check:
    @files=$(git ls-files -co --exclude-standard '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs'); \
    if [ -z "$files" ]; then echo "fmt: no source files yet"; \
    elif command -v oxfmt >/dev/null; then oxfmt --check .; \
    else prettier --check .; fi

fmt:
    @if command -v oxfmt >/dev/null; then oxfmt .; else prettier --write .; fi

typecheck:
    pnpm -r --include-workspace-root run typecheck

enforce:
    scripts/check-vi-mock.sh
    scripts/check-origins.sh
    scripts/check-playwright-version.sh
    scripts/check-test-placement.sh

# ---------------------------------------------------------------------------
# tests
# ---------------------------------------------------------------------------

# Layers 1+2, changed files only. Agent inner loop. The only recipe that passes with zero tests.
test:
    #!/usr/bin/env bash
    set -euo pipefail
    rm -f {{results}}/unit.json {{results}}/browser.json
    if base=$(git merge-base HEAD origin/{{base_branch}} 2>/dev/null); then changed="--changed=$base"; else changed="--changed"; fi
    echo "vitest $changed"
    pnpm exec vitest run --project unit "$changed" --passWithNoTests --reporter=default --reporter=@repo/test-config/reporter --outputFile={{results}}/unit.json
    pnpm exec vitest run --project browser "$changed" --passWithNoTests --reporter=default --reporter=@repo/test-config/reporter --outputFile={{results}}/browser.json

# Layer 1 full. Fails on zero tests.
test-unit:
    rm -f {{results}}/unit.json
    pnpm exec vitest run --project unit --reporter=default --reporter=@repo/test-config/reporter --outputFile={{results}}/unit.json

# Layer 2 full. Fails on zero tests.
test-browser:
    rm -rf {{results}}/browser.json {{results}}/browser
    pnpm exec vitest run --project browser --reporter=default --reporter=@repo/test-config/reporter --outputFile={{results}}/browser.json

# Layer 3. Requires `just server` already up; fails fast otherwise.
test-e2e: server-status
    rm -rf {{results}}/e2e.json {{results}}/e2e
    cd apps/web && pnpm exec playwright test

# Everything, from a clean test-results/. Task-completion gate.
test-all:
    rm -rf {{results}}
    just check
    just test-unit
    just test-browser
    just server-restart
    just test-e2e
    node scripts/report-durations.mjs

# ---------------------------------------------------------------------------
# server supervisor
# ---------------------------------------------------------------------------

# Long-lived: mock-server -> next build -> next start. Humans only, never agents.
# Pass `-D` to detach; `just server-down` stops a detached supervisor.
server *flags:
    process-compose up -f process-compose.yaml --disable-dotenv -t=false -p {{pc_port}} {{flags}}

server-down:
    process-compose down -p {{pc_port}}

# Detached rebuild + restart, then block until both health checks pass (or 180s).
server-restart:
    #!/usr/bin/env bash
    set -euo pipefail
    just server-down >/dev/null 2>&1 || true
    sleep 1
    just server -D
    just server-wait

server-wait timeout="180":
    #!/usr/bin/env bash
    set -euo pipefail
    for _ in $(seq 1 $(( {{timeout}} / 2 ))); do
      if just server-status >/dev/null 2>&1; then just server-status; exit 0; fi
      build=$(process-compose process get next-build -p {{pc_port}} 2>/dev/null | awk 'NR==2{print $4" "$8}')
      if [ "$build" = "Completed 1" ]; then
        echo "next build failed:"; process-compose process logs next-build -p {{pc_port}} | tail -40; exit 1
      fi
      sleep 2
    done
    echo "server did not become ready within {{timeout}}s"; exit 1

server-logs process="next-build":
    process-compose process logs {{process}} -p {{pc_port}}

# Both health endpoints, bounded so the e2e gate answers within 5s.
server-status:
    @curl -fsS --max-time 2 http://127.0.0.1:{{mock_port}}/__health >/dev/null || { echo "mock server down on :{{mock_port}}"; exit 1; }
    @curl -fsS --max-time 2 -o /dev/null http://127.0.0.1:{{APP_PORT}}/ || { echo "app server down on :{{APP_PORT}}"; exit 1; }
    @echo "server up: mock :{{mock_port}}, app :{{APP_PORT}}"

# ---------------------------------------------------------------------------
# setup phase (network, outside sandbox, humans only)
# ---------------------------------------------------------------------------

# Regenerate packages/types/src/supabase.ts from a real project. Needs SUPABASE_PROJECT_ID + network.
gen-types:
    @: "${SUPABASE_PROJECT_ID:?set SUPABASE_PROJECT_ID to the project ref}"
    pnpm dlx supabase gen types typescript --project-id "$SUPABASE_PROJECT_ID" --schema public > packages/types/src/supabase.ts
    just fmt
