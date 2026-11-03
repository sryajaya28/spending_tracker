#!/usr/bin/env bash
# Usage: check-pr-scope.sh <base-ref> <head-branch>
# CI backstop for the write-scope matrix. Agent branches must only touch their role's paths.
#   feature/<slug>-be -> backend-engineer, feature/<slug>-fe -> frontend-engineer
# Other branches are human branches: skipped here (CODEOWNERS still protects sensitive paths).
set -uo pipefail
base="${1:?base ref}"; branch="${2:?head branch}"
case "$branch" in
  feature/*-be) role=backend-engineer;;
  feature/*-fe) role=frontend-engineer;;
  *) echo "branch '$branch' is not an agent branch, scope check skipped"; exit 0;;
esac
bad=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if ! "$(dirname "$0")/check-write-scope.sh" "$role" "$f" 2>/dev/null; then echo "FAIL: $role may not change $f"; bad=1; fi
done < <(git diff --name-only "$base"...HEAD)
[ "$bad" = 0 ] && echo "ok: all changes inside $role scope"
exit "$bad"
