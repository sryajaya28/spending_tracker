#!/usr/bin/env bash
# Browser tests for the prototype. They run the real app in headless Chromium against an in-memory stand-in for
# Supabase (fake_supabase.js), so no network, accounts or database are touched.
#
#   one-time:  npm install -g playwright && npx playwright install chromium   (or use a preinstalled one)
#   run all:   bash tests/e2e/run_all.sh
#   run one:   bash tests/e2e/run_all.sh transfer   (several names allowed; JOBS=n sets the parallelism, default 4)
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
[ ${#tests[@]} -eq 0 ] && tests=(settingshub sample searchlists lent household_join household_labels household_activity run occnobudget fees spenthero loginstart inrphp onboarding balancecheck repay debtrec debtedit invest debtcalc curdd cats quickcat transfer budgetbar wallet arch occtx daily donut pfrange hidebal recurring coin noscroll period idx cashacct cashxfer movehold avgprice handoff trend scrollpos datepick loanpay support recedit modalscroll lastacct samplelocal dropdown ovocc ios confirm csp analytics consent archcat landshot langsave darkshots)
fail=0
[ ${#tests[@]} -gt 3 ] && { python3 "$ROOT/tests/test_yahoo.py" 2>&1 | grep -q '^ok' && echo "PASS  yahoo (python)" || { echo "FAIL  yahoo (python)"; fail=1; }; }
# the browser tests are independent (each starts its own browser against the same static server), so run JOBS of them at a time
# (default 4; JOBS=1 for the old one-by-one run). Results are printed in the original order.
JOBS="${JOBS:-4}"
res=$(mktemp -d)
run_one() {
  t="$1"; res="$2"
  out=$(timeout 250 node "$t.js" 2>&1 | grep -E "^ok|^FAIL|landing ok|signed out|AssertionError" | head -1)
  case "$out" in
    ok*|*"landing ok"*|*"signed out"*) echo "PASS  $t" > "$res/$t" ;;
    *) echo "FAIL  $t  $out" > "$res/$t" ;;
  esac
}
export -f run_one
printf '%s\n' "${tests[@]}" | xargs -P "$JOBS" -I{} bash -c 'run_one {} '"$res"
for t in "${tests[@]}"; do
  line=$(cat "$res/$t" 2>/dev/null || echo "FAIL  $t  (no result)")
  echo "$line"; case "$line" in FAIL*) fail=1 ;; esac
done
rm -rf "$res"
exit $fail
