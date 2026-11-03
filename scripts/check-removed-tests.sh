#!/usr/bin/env bash
# Usage: check-removed-tests.sh <base-ref>   (compares base-ref...HEAD)
# Fails if a PR deletes a test file, removes more test declarations than it adds,
# or adds a skip/only marker. Never weaken tests (CLAUDE.md rule 8).
set -uo pipefail
base="${1:?base ref required}"
fail=0
globs=('*.test.*' '*.spec.*' 'tests/*' '*/tests/*' '*/__tests__/*')

deleted="$(git diff --diff-filter=D --name-only "$base"...HEAD -- "${globs[@]}")"
if [ -n "$deleted" ]; then echo "FAIL: test files deleted:"; echo "$deleted"; fail=1; fi

patch="$(git diff -U0 "$base"...HEAD -- "${globs[@]}")"
body='[[:space:]]*((it|test|describe)(\.each)?\(|def test_|(async )?function test)'
removed="$(printf '%s\n' "$patch" | grep -Ec "^-$body" || true)"
added="$(printf '%s\n' "$patch" | grep -Ec "^\+$body" || true)"
if [ "$removed" -gt "$added" ]; then echo "FAIL: $removed test declarations removed, only $added added"; fail=1; fi

skips="$(printf '%s\n' "$patch" | grep -E '^\+' | grep -E '\.(skip|only|todo)\(|\bxit\(|\bxdescribe\(|\bxtest\(|pytest\.mark\.skip|@Disabled|t\.Skip\(' || true)"
if [ -n "$skips" ]; then echo "FAIL: skip/only markers added:"; echo "$skips"; fail=1; fi

[ "$fail" = 0 ] && echo "ok: no removed, skipped, or weakened tests detected"
exit "$fail"
