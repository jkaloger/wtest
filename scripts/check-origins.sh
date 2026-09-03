#!/usr/bin/env bash
# No origin literals in the app source. Origins come from env, read only in lib/<origin>/client.ts.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC_DIR="apps/web/src"
ALLOWLIST="scripts/origin-allowlist.txt"

status=0
while IFS= read -r file; do
  case "$file" in "$SRC_DIR"/lib/*/client.ts) continue ;; esac
  while IFS= read -r hit; do
    allowed=0
    while IFS= read -r literal; do
      [ -z "$literal" ] && continue
      case "$literal" in \#*) continue ;; esac
      if [[ "$hit" == *"$literal"* ]]; then allowed=1; break; fi
    done < "$ALLOWLIST"
    if [ "$allowed" -eq 0 ]; then
      echo "check-origins: $hit"
      status=1
    fi
  done < <(grep -nE 'https?://' "$file" | sed "s|^|$file:|" || true)
done < <(git ls-files -co --exclude-standard "$SRC_DIR")

[ "$status" -eq 0 ] && echo "check-origins: ok"
exit "$status"
