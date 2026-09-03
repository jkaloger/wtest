#!/usr/bin/env bash
# Tests colocate with their subject under src/ or live in e2e/. Never under app/, __tests__/, or tests/.
set -euo pipefail
cd "$(dirname "$0")/.."

APP_DIR="apps/web/app"
status=0

while IFS= read -r file; do
  echo "check-test-placement: test file under $APP_DIR: $file"
  status=1
done < <(git ls-files -co --exclude-standard "$APP_DIR" | grep -E '\.(test|spec)\.[cm]?[jt]sx?$' || true)

while IFS= read -r file; do
  echo "check-test-placement: forbidden test directory: $file"
  status=1
done < <(git ls-files -co --exclude-standard | grep -E '(^|/)(__tests__|tests)/' | grep -v node_modules || true)

[ "$status" -eq 0 ] && echo "check-test-placement: ok"
exit "$status"
