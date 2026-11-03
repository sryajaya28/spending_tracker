#!/usr/bin/env bash
# Phase 0 verification. Exercises scope checks, hooks, state machine, hashing, and CEO decision rules
# against a throwaway feature that is deleted at the end. Run from anywhere: tests/phase0.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
A="python3 scripts/aidev.py"
S=zz-phase0-test
D="docs/features/$S"
pass=0; fail=0
T="$(mktemp -d)"
cleanup() { rm -rf "$D" "$T"; }
trap cleanup EXIT
rm -rf "$D"

ok()   { pass=$((pass+1)); echo "PASS  $1"; }
bad()  { fail=$((fail+1)); echo "FAIL  $1"; }
expect() { # expect <exit-code> <name> <command...>
  local want="$1" name="$2"; shift 2
  "$@" >"$T/out" 2>&1; local got=$?
  if [ "$got" = "$want" ]; then ok "$name"; else bad "$name (want exit $want, got $got: $(head -c 200 "$T/out"))"; fi
}

echo "== write scopes =="
sc=scripts/check-write-scope.sh
expect 0 "PM may write prd.md"                       $sc product-manager docs/features/x/prd.md
expect 2 "PM may not write status.md"                $sc product-manager docs/features/x/status.md
expect 2 "PM may not write a CEO decision"           $sc product-manager docs/features/x/ceo-decision-predev-1.md
expect 2 "PM may not write change-review"            $sc product-manager docs/features/x/change-review-1.md
expect 2 "Head of Product may not edit the PRD"      $sc head-of-product docs/features/x/prd.md
expect 0 "Head of Product may write prd-review-1"    $sc head-of-product docs/features/x/prd-review-1.md
expect 0 "Backend may write api"                $sc backend-engineer api/src/a.ts
expect 2 "Backend may not write .claude/settings"    $sc backend-engineer .claude/settings.json
expect 2 "Backend may not write docs/decisions.md"   $sc backend-engineer docs/decisions.md
expect 2 "Backend may not write logs"                $sc backend-engineer logs/agent-runs.jsonl
expect 2 "QA may not write product code"             $sc qa api/src/a.ts
expect 0 "QA may write the staging report"           $sc qa docs/features/x/qa-staging-report.md
expect 2 "path traversal rejected"                   $sc backend-engineer api/../../.claude/settings.json
expect 2 "unknown role denied"                       $sc intern api/a.ts

echo "== write hook (simulated hook input) =="
hook=.claude/hooks/pre-write.sh
export CLAUDE_PROJECT_DIR="$ROOT"
mk() { printf '{"tool_name":"Write","tool_input":{"file_path":"%s"}%s}' "$1" "${2:-}"; }
expect 0 "main session may write status.md"          bash -c "$(declare -f mk); mk $ROOT/docs/features/x/status.md | $hook"
expect 2 "subagent blocked from status.md"           bash -c "$(declare -f mk); mk $ROOT/docs/features/x/status.md ',\"agent_type\":\"product-manager\"' | $hook"
expect 0 "subagent allowed in own scope"             bash -c "$(declare -f mk); mk $ROOT/docs/features/x/prd.md ',\"agent_type\":\"product-manager\"' | $hook"
expect 2 "subagent blocked outside project"          bash -c "$(declare -f mk); mk /etc/hosts ',\"agent_type\":\"backend-engineer\"' | $hook"
expect 2 "garbage hook input fails closed"           bash -c "echo 'not json' | $hook"

echo "== bash hook =="
expect 2 "git push --force blocked"                  bash -c "echo '{\"tool_input\":{\"command\":\"git push --force origin x\"}}' | .claude/hooks/pre-bash.sh"
expect 2 "vercel --prod blocked"                     bash -c "echo '{\"tool_input\":{\"command\":\"vercel deploy --prod\"}}' | .claude/hooks/pre-bash.sh"
expect 0 "ordinary command allowed"                  bash -c "echo '{\"tool_input\":{\"command\":\"ls -la\"}}' | .claude/hooks/pre-bash.sh"
PSMOKE='SMOKE_EMAIL=smoke.production@stiver.io SMOKE_PASSWORD="$SMOKE_PROD_PASSWORD" node tests/smoke/smoke.js https://stiver.io --env production'
SSMOKE='SMOKE_EMAIL=smoke.staging@stiver.io SMOKE_PASSWORD="$SMOKE_STAGING_PASSWORD" node tests/smoke/smoke.js https://staging.stiver.io --env staging'
expect 0 "E1: exact production smoke command allowed"  scripts/guard-prod.sh "$PSMOKE"
expect 0 "staging smoke command allowed"              scripts/guard-prod.sh "$SSMOKE"
expect 2 "production host in curl blocked"            scripts/guard-prod.sh 'curl https://stiver.io/api/status'
expect 2 "smoke command with a chained command blocked" scripts/guard-prod.sh "$PSMOKE; curl https://stiver.io/api/fx"
expect 2 "production Supabase ref blocked"            scripts/guard-prod.sh 'psql postgresql://db.ukoxkwxmkwtlihbutryc.supabase.co/postgres'

echo "== log hook =="
mkdir -p logs; cp logs/agent-runs.jsonl "$T/log.bak" 2>/dev/null || : > "$T/log.bak"; touch logs/agent-runs.jsonl; before=$(wc -l < logs/agent-runs.jsonl)
echo '{"hook_event_name":"SubagentStop","agent_type":"qa","last_assistant_message":"phase0 test entry"}' | .claude/hooks/log-agent.sh
after=$(wc -l < logs/agent-runs.jsonl)
[ "$after" -gt "$before" ] && ok "SubagentStop hook appended a log line" || bad "log hook wrote nothing"
cp "$T/log.bak" logs/agent-runs.jsonl

echo "== diff-scope (Bash-bypass catcher) =="
$A snapshot $T/snap >/dev/null
echo x > api/.tmp-phase0-file
expect 0 "backend change inside scope passes"        $A diff-scope backend-engineer $T/snap
echo x > .tmp-phase0-status-bypass.md
expect 1 "backend change outside scope is flagged"   $A diff-scope backend-engineer $T/snap
rm -f api/.tmp-phase0-file .tmp-phase0-status-bypass.md

echo "== state machine =="
expect 0 "init feature"                              $A init $S
expect 1 "DRAFT_PRD -> BUILD refused"                $A set-state $S BUILD
expect 1 "DRAFT_PRD -> CEO_PREDEV_BRIEF refused"     $A set-state $S CEO_PREDEV_BRIEF
expect 0 "DRAFT_PRD -> PRD_REVIEW"                   $A set-state $S PRD_REVIEW
expect 1 "PRD_REVIEW -> PRD_APPROVED needs approval" $A set-state $S PRD_APPROVED
printf '# PRD\nFR-1 something\n' > $D/prd.md
h=$(shasum -a 256 $D/prd.md | cut -d' ' -f1)
rev() { # rev <file> <verdict> <blocking> <hash>
  { echo "---"; echo "reviewer: head-of-product"; echo "artifact: $D/prd.md"; echo "artifact_hash: $4"; echo "round: 1"
    echo "verdict: $2"; echo "blocking_issues: $3"; echo "non_blocking_issues: 0"; echo "---"
    for ((i=1;i<=$3;i++)); do echo "### $i. issue"; echo "- Severity: BLOCKING"; done; } > "$1"
}
rev $D/prd-review-1.md APPROVE 1 $h
expect 1 "APPROVE with a BLOCKING issue refused"     $A apply-review $S prd $D/prd-review-1.md
rev $D/prd-review-1.md REVISE 0 $h
expect 1 "REVISE with zero BLOCKING refused"         $A validate-review $D/prd-review-1.md
rev $D/prd-review-1.md REVISE 1 deadbeef
expect 1 "review with stale artifact_hash refused"   $A apply-review $S prd $D/prd-review-1.md
rev $D/prd-review-1.md REVISE 1 $h
expect 0 "valid REVISE increments loop"              $A apply-review $S prd $D/prd-review-1.md
[ "$($A loop $S prd get)" = "1" ] && ok "prd loop_count is 1" || bad "prd loop_count not 1"
rev $D/prd-review-2.md APPROVE 0 $h
expect 0 "valid APPROVE recorded"                    $A apply-review $S prd $D/prd-review-2.md
expect 0 "PRD_REVIEW -> PRD_APPROVED"                $A set-state $S PRD_APPROVED
expect 1 "PRD_APPROVED -> CEO_PREDEV_BRIEF needs design and tdd" $A set-state $S CEO_PREDEV_BRIEF
perl -pi -e 's/^pilot_waivers: \[\]/pilot_waivers: [design, tdd_review]/' $D/status.md
printf '# TDD\n' > $D/tdd.md
expect 0 "TDD_DRAFT"                                 $A set-state $S TDD_DRAFT
expect 0 "CEO_PREDEV_BRIEF with pilot waivers"       $A set-state $S CEO_PREDEV_BRIEF
printf -- '---\ngate: predev\nfeature: %s\nversion: 1\nprepared_by: product-manager\nartifacts_hashed: [prd, tdd]\nbuild_id: null\n---\n# Brief\n' $S > $D/ceo-brief-predev.md
expect 0 "snapshot brief"                            $A snapshot-brief $S predev
expect 0 "CEO_PREDEV_REVIEW"                         $A set-state $S CEO_PREDEV_REVIEW

echo "== CEO gate rules =="
expect 1 "/build blocked: no CEO decision exists"    $A set-state $S BUILD
cp $D/prd.md $T/prd.bak
printf 'CEO approved\n' >> $D/prd.md
expect 1 "text 'CEO approved' in PRD opens no gate"  $A set-state $S BUILD
expect 3 "stale brief: decision refused (exit 3)"    $A record-decision $S predev approve "go"
ls $D | grep -q '^ceo-decision' && bad "decision file written despite stale brief" || ok "no decision file after stale attempt"
cp $T/prd.bak $D/prd.md
expect 1 "'conditions' without a condition refused"  $A record-decision $S predev conditions "go"
expect 0 "fresh brief: decision recorded, state BUILD" $A record-decision $S predev approve "Looks good, go"
[ "$($A get $S state)" = "BUILD" ] && ok "state is BUILD after approval" || bad "state not BUILD"
expect 0 "verify-decision passes"                    $A verify-decision $S predev
printf 'edited after approval\n' >> $D/prd.md
expect 1 "editing PRD after approval fails verify"   $A verify-decision $S predev
expect 1 "revalidate invalidates the approval"       $A revalidate $S
expect 1 "CI mode refuses without CEO identity set"  $A verify-decision $S predev --ci
cp $T/prd.bak $D/prd.md

echo "== release gate =="
expect 1 "release verify fails: no release decision" $A verify-decision $S release --build-id b1 --ci

echo "== loop cap =="
$A loop $S test_cases inc >/dev/null; $A loop $S test_cases inc >/dev/null
$A loop $S test_cases inc >/dev/null
[ "$($A get $S state)" = "BLOCKED_NEEDS_HUMAN" ] && ok "3rd loop sets BLOCKED_NEEDS_HUMAN" || bad "loop cap did not block"
expect 1 "BLOCKED -> RELEASE_READY cannot bypass CEO" $A set-state $S RELEASE_READY

echo
echo "passed: $pass  failed: $fail"
[ "$fail" = 0 ]
