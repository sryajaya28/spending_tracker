#!/usr/bin/env bash
# Usage: check-write-scope.sh <role> <path-relative-to-repo-root>
# Exit 0 if the role may write the path, exit 2 otherwise. Allowlist only: anything not listed is denied.
# Source of truth: docs/team-protocol.md Section 7.
set -uo pipefail
role="${1:-}"; p="${2:-}"
[ -n "$role" ] && [ -n "$p" ] || { echo "usage: check-write-scope.sh <role> <path>" >&2; exit 2; }
case "$p" in /*|*..*|*$'\n'*) echo "scope: rejected path $p" >&2; exit 2;; esac
F='^docs/features/[a-z0-9][a-z0-9-]*/'
allow=()
case "$role" in
  product-manager)
    allow=("${F}(prd\.md|design-review-[0-9]+\.md|test-cases-review-[0-9]+\.md|uat-signoff\.md|change-[0-9]+\.md|ceo-brief-predev\.md|ceo-brief-demo\.md|data/request-[0-9]+\.md)$");;
  head-of-product)
    allow=("${F}(prd-review-[0-9]+\.md|change-review-[0-9]+\.md)$");;
  principal-engineer)
    allow=("${F}(tdd-review|fe-plan-review|code-review|adr|change-impact)-[0-9]+\.md$");;
  backend-engineer)
    allow=("${F}(tdd\.md|questions-be-[0-9]+\.md)$" '^api/' '^supabase/migrations/');;
  frontend-engineer)
    allow=("${F}(fe-plan\.md|questions-fe-[0-9]+\.md)$" '^prototype/');;
  qa)
    allow=("${F}(test-cases\.md|qa-staging-report\.md|smoke-prod-report\.md|defects/DEF-[0-9]+\.md)$" '^tests/');;
  designer)
    allow=("${F}(design/.+|questions-design-[0-9]+\.md)$" '^docs/design-system/' '^design/');;
  data-analyst)
    allow=("${F}(data/analysis-[0-9]+\.md|data/tracking-check\.md)$" '^analytics/' '^docs/data/metrics-catalog\.md$');;
  *) echo "scope: unknown role '$role', denied" >&2; exit 2;;
esac
for re in "${allow[@]}"; do
  if [[ "$p" =~ $re ]]; then exit 0; fi
done
echo "scope: role '$role' may not write '$p' (docs/team-protocol.md Section 7)" >&2
exit 2
