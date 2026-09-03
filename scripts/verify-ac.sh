#!/usr/bin/env bash
# Runs SPEC.md acceptance criteria AC2-AC9 as executable checks and prints a table.
# AC1 is the CI job (unshare + nix develop) and is reported as SKIP here.
# Plants violations into the tree and reverts them; run on a clean checkout.
set -uo pipefail
cd "$(dirname "$0")/.."

results=()
pass() { results+=("AC$1|PASS|$2"); }
fail() { results+=("AC$1|FAIL|$2"); }
skip() { results+=("AC$1|SKIP|$2"); }
quiet() { "$@" >/dev/null 2>&1; }
vitest_browser() { pnpm exec vitest run --project browser "$@"; }

skip 1 "CI: unshare -Urn -- nix develop -c just test-all"

# AC2: component querying an external origin passes with handlers, fails when they are removed.
if quiet vitest_browser apps/web/src/components/profile-search; then
  if quiet env DEMO_UNHANDLED=1 vitest_browser apps/web/src/components/__demo__/unhandled; then
    fail 2 "test still passed with every handler removed"
  else
    pass 2 "happy path green; handler removed -> failure"
  fi
else
  fail 2 "profile-search browser test failed on the happy path"
fi

# AC3: editing one component runs only tests whose import graph includes it.
card=apps/web/src/components/profile-card/index.tsx
if git diff --quiet -- "$card"; then
  printf '\n// ac3 probe\n' >> "$card"
  start=$(date +%s)
  quiet just test
  elapsed=$(( $(date +%s) - start ))
  git checkout -q -- "$card"
  ran=$(node -e '
    const fs = require("node:fs");
    const files = [];
    for (const f of ["unit", "browser"]) {
      if (!fs.existsSync(`test-results/${f}.json`)) continue;
      for (const r of JSON.parse(fs.readFileSync(`test-results/${f}.json`, "utf8")).testResults) files.push(r.name);
    }
    console.log(files.join(" "));
  ')
  case "$ran" in
    *profile-card.browser.test.tsx) pass 3 "only profile-card tests ran (${elapsed}s, soft target <5s)" ;;
    "") fail 3 "no tests ran after editing profile-card" ;;
    *) fail 3 "unrelated tests ran: $ran" ;;
  esac
else
  skip 3 "$card has local changes"
fi

# AC4: a failing browser test writes a PNG under test-results/browser and the JSON report names it.
if quiet env DEMO_FAIL=1 just test-browser; then
  fail 4 "DEMO_FAIL=1 just test-browser exited 0"
else
  png=$(node -e '
    const j = require("./test-results/browser.json");
    const shots = j.testResults.flatMap(r => r.assertionResults.flatMap(a => a.screenshots ?? []));
    console.log(shots[0] ?? "");
  ')
  if [ -n "$png" ] && [ -f "$png" ] && [[ "$png" == *"/test-results/browser/"* ]]; then
    pass 4 "${png#"$PWD/"}"
  else
    fail 4 "no screenshot path in test-results/browser.json (got '$png')"
  fi
fi

# AC5: check fails on cross-layer imports and on tests under app/.
plant5=(apps/web/src/lib/profiles/ac5.test.ts apps/web/e2e/ac5.spec.ts apps/web/app/ac5.test.ts)
printf 'import { test } from "@playwright/test";\ntest("x", () => {});\n' > "${plant5[0]}"
printf 'import { expect } from "vitest";\nimport { ProfileCard } from "../src/components/profile-card";\nconsole.log(expect, ProfileCard);\n' > "${plant5[1]}"
printf 'export {};\n' > "${plant5[2]}"
lint_failed=0; placement_failed=0
quiet oxlint --deny-warnings . || lint_failed=1
quiet scripts/check-test-placement.sh || placement_failed=1
rm -f "${plant5[@]}"
if [ $lint_failed -eq 1 ] && [ $placement_failed -eq 1 ]; then
  pass 5 "oxlint rejects cross-layer imports; placement rejects app/ tests"
else
  fail 5 "lint_failed=$lint_failed placement_failed=$placement_failed"
fi

# AC6: origin literal outside lib/*/client.ts fails check; inside it passes.
printf 'export const leak = "https://abcdefgh.supabase.co";\n' > apps/web/src/lib/profiles/ac6.ts
outside=0; quiet scripts/check-origins.sh || outside=1
rm -f apps/web/src/lib/profiles/ac6.ts
mkdir -p apps/web/src/lib/ac6 && printf 'export const ok = "https://abcdefgh.supabase.co";\n' > apps/web/src/lib/ac6/client.ts
inside=0; quiet scripts/check-origins.sh || inside=1
rm -rf apps/web/src/lib/ac6
if [ $outside -eq 1 ] && [ $inside -eq 0 ]; then
  pass 6 "literal rejected in src, allowed in lib/*/client.ts"
else
  fail 6 "outside_failed=$outside inside_failed=$inside"
fi

# AC7: next build completed against the mock server and e2e passes against next start.
if quiet just server-status; then
  build=$(process-compose process get next-build -p "${PC_PORT:-8474}" 2>/dev/null | awk 'NR==2{print $4" "$8}')
  if [ "$build" = "Completed 0" ]; then
    if quiet just test-e2e; then pass 7 "next build exit 0 with mock up; e2e green"; else fail 7 "e2e failed"; fi
  else
    fail 7 "next-build state: '$build' (expected 'Completed 0'); is the supervisor detached on PC_PORT?"
  fi
else
  fail 7 "server not up: run 'just server -D && just server-wait' first"
fi

# AC8: playwright version pin vs nix driver.
if quiet scripts/check-playwright-version.sh && ! quiet env PLAYWRIGHT_VERSION=9.9.9 scripts/check-playwright-version.sh; then
  pass 8 "matches ${PLAYWRIGHT_VERSION:-?}; drift rejected"
else
  fail 8 "version check did not behave"
fi

# AC9: test-e2e exits non-zero within 5s when the server is down. Restores the server afterwards.
was_up=0; quiet just server-status && was_up=1
[ $was_up -eq 1 ] && quiet just server-down && sleep 1
start=$(date +%s)
quiet just test-e2e; code=$?
elapsed=$(( $(date +%s) - start ))
if [ $code -ne 0 ] && [ $elapsed -le 5 ]; then
  pass 9 "exit $code after ${elapsed}s with server down"
else
  fail 9 "exit $code after ${elapsed}s"
fi
if [ $was_up -eq 1 ]; then quiet just server -D; quiet just server-wait || echo "warning: server did not come back"; fi

echo
echo "AC   result  detail"
status=0
for row in "${results[@]}"; do
  IFS='|' read -r ac result detail <<< "$row"
  printf '%-4s %-7s %s\n' "$ac" "$result" "$detail"
  [ "$result" = "FAIL" ] && status=1
done
exit $status
