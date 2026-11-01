#!/usr/bin/env bash
# Browser tests for the prototype. They run the real app in headless Chromium against an in-memory stand-in for
# Supabase (fake_supabase.js), so no network, accounts or database are touched.
#
#   one-time:  npm install -g playwright && npx playwright install chromium   (or use a preinstalled one)
#   run all:   bash tests/e2e/run_all.sh
#   run one:   bash tests/e2e/run_all.sh transfer
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
python3 tools/dev_server.py 5180 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1
cd tests/e2e
mkdir -p out out/dark
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
tests=("$@")
[ ${#tests[@]} -eq 0 ] && tests=(sample run curdd cats quickcat transfer budgetbar wallet arch occtx daily donut pfrange recurring coin noscroll period idx cashacct avgprice handoff dropdown ovocc ios confirm csp landshot langsave darkshots)
fail=0
[ ${#tests[@]} -gt 3 ] && { python3 "$ROOT/tests/test_yahoo.py" 2>&1 | grep -q '^ok' && echo "PASS  yahoo (python)" || { echo "FAIL  yahoo (python)"; fail=1; }; }
for t in "${tests[@]}"; do
  out=$(timeout 250 node "$t.js" 2>&1 | grep -E "^ok|^FAIL|landing ok|signed out|AssertionError" | head -1)
  case "$out" in
    ok*|*"landing ok"*|*"signed out"*) echo "PASS  $t" ;;
    *) echo "FAIL  $t  $out"; fail=1 ;;
  esac
done
exit $fail
