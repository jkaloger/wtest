set shell := ["bash", "-euo", "pipefail", "-c"]
set dotenv-filename := ".env.test"
set dotenv-load := true

base_branch := env("BASE_BRANCH", "main")
mock_port := env("MOCK_PORT", "4010")
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
    pnpm -r exec tsc --noEmit

# ---------------------------------------------------------------------------
# tests
# ---------------------------------------------------------------------------

# Layers 1+2, changed files only. Agent inner loop.
test:
    @echo "not implemented until phase 10" && exit 1

# Layer 1 full.
test-unit:
    @echo "not implemented until phase 5" && exit 1

# Layer 2 full.
test-browser:
    @echo "not implemented until phase 6" && exit 1

# Layer 3. Requires `just server` already up.
test-e2e:
    @echo "not implemented until phase 8" && exit 1

# Everything, from a clean test-results/. Task-completion gate.
test-all:
    @echo "not implemented until phase 10" && exit 1

# ---------------------------------------------------------------------------
# server supervisor
# ---------------------------------------------------------------------------

# Long-lived: mock-server -> next build -> next start. Humans only, never agents.
server:
    @echo "not implemented until phase 7" && exit 1

server-status:
    @echo "not implemented until phase 7" && exit 1

# ---------------------------------------------------------------------------
# setup phase (network, outside sandbox, humans only)
# ---------------------------------------------------------------------------

gen-types:
    @echo "not implemented until phase 1" && exit 1
