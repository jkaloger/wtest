#!/usr/bin/env bash
# pnpm rewrites pnpm-workspace.yaml with a literal placeholder when a new dependency has build
# scripts. Left in place it is neither true nor false; fail until a human decides.
set -euo pipefail
cd "$(dirname "$0")/.."
if grep -n "set this to true or false" pnpm-workspace.yaml; then
  echo "pnpm-workspace.yaml: resolve the allowBuilds placeholder above" >&2
  exit 1
fi
echo "check-workspace-yaml: ok"
