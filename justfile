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

# oxlint, format check, typecheck. Phase 9 adds the enforcement scripts.
check: lint fmt-check typecheck

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
    pnpm -r --include-workspace-root exec tsc --noEmit

# ---------------------------------------------------------------------------
# tests
# ---------------------------------------------------------------------------

# Layers 1+2, changed files only. Agent inner loop.
test:
    @echo "not implemented until phase 10" && exit 1

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
    @echo "not implemented until phase 8" && exit 1

# Everything, from a clean test-results/. Task-completion gate.
test-all:
    @echo "not implemented until phase 10" && exit 1

# ---------------------------------------------------------------------------
# server supervisor
# ---------------------------------------------------------------------------

# Long-lived: mock-server -> next build -> next start. Humans only, never agents.
# Pass `-D` to detach; `just server-down` stops a detached supervisor.
server *flags:
    process-compose up -f process-compose.yaml --disable-dotenv -t=false -p {{pc_port}} {{flags}}

server-down:
    process-compose down -p {{pc_port}}

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

gen-types:
    @echo "not implemented until phase 1" && exit 1
