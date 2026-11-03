#!/usr/bin/env bash
# PreToolUse hook for Bash. Blocks commands that match docs/engineering-standards/prod-markers.txt
# (force push, push to main, --prod, production hosts). Only exit 2 blocks, so errors exit 2.
set -uo pipefail
fail() { echo "pre-bash: $1" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || fail "jq missing, blocking"
input="$(cat)"
printf '%s' "$input" | jq -e . >/dev/null 2>&1 || fail "unparseable hook input, blocking"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"
[ -n "$cmd" ] || exit 0
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
root="${CLAUDE_PROJECT_DIR:-$here}"
exec "$root/scripts/guard-prod.sh" "$cmd"
