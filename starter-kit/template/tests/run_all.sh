#!/usr/bin/env bash
# The one test command (CLAUDE.md, CI). Prints one PASS/FAIL line per test and exits 1 on any failure.
#   bash tests/run_all.sh
# Add this project's suites to the list below as they are built (unit, browser, SQL).
set -u
cd "$(dirname "$0")/.."
fail=0
run() { name="$1"; shift; if out=$("$@" 2>&1); then echo "PASS  $name"; else echo "FAIL  $name  $(echo "$out" | tail -1)"; fail=1; fi; }
for t in tools/*.test.js; do [ -f "$t" ] && run "$(basename "$t" .test.js) (tool)" node "$t"; done
run "doc budget" node tools/doc_budget.js
[ -f tests/e2e/run_all.sh ] && { bash tests/e2e/run_all.sh || fail=1; }
exit $fail
