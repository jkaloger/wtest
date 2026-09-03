#!/usr/bin/env bash
# Browsers come from nix (playwright-driver). The npm packages must match that version exactly (AC8).
set -euo pipefail
cd "$(dirname "$0")/.."

expected="${PLAYWRIGHT_VERSION:?PLAYWRIGHT_VERSION is unset: run via direnv exec}"
status=0
for pkg in playwright @playwright/test; do
  actual=$(cd apps/web && node -p "require('$pkg/package.json').version")
  if [ "$actual" != "$expected" ]; then
    echo "check-playwright-version: $pkg is $actual, nix playwright-driver is $expected"
    status=1
  fi
done

[ "$status" -eq 0 ] && echo "check-playwright-version: ok ($expected)"
exit "$status"
