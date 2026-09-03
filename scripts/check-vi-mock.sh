#!/usr/bin/env bash
# MSW is the only HTTP double. `vi.mock(` needs a per-file `// mock-allow: <reason>` escape hatch.
set -euo pipefail
cd "$(dirname "$0")/.."

status=0
while IFS= read -r file; do
  if grep -q 'vi\.mock(' "$file" && ! grep -q '// mock-allow: ' "$file"; then
    echo "check-vi-mock: $file uses vi.mock without '// mock-allow: <reason>'"
    status=1
  fi
done < <(git ls-files -co --exclude-standard '*.ts' '*.tsx' '*.mts' '*.js' '*.jsx' '*.mjs')

[ "$status" -eq 0 ] && echo "check-vi-mock: ok"
exit "$status"
