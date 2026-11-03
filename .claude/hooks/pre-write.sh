#!/usr/bin/env bash
# PreToolUse hook for Write, Edit, MultiEdit, NotebookEdit.
# Main session (no agent_type): allowed. Subagent (agent_type set): the path must be inside the
# project and inside the role's allowlist (scripts/check-write-scope.sh, team-protocol Section 7).
# Only exit 2 blocks. Any other failure fails open, so every error path here exits 2.
set -uo pipefail
fail() { echo "pre-write: $1" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || fail "jq missing, blocking"
input="$(cat)"
printf '%s' "$input" | jq -e . >/dev/null 2>&1 || fail "unparseable hook input, blocking"
role="$(printf '%s' "$input" | jq -r '.agent_type // empty')"
[ -z "$role" ] && exit 0
path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')"
[ -n "$path" ] || fail "no file path in hook input, blocking"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
root="$(realpath -m "${CLAUDE_PROJECT_DIR:-$here}")"
case "$path" in /*) abs="$path";; *) abs="$root/$path";; esac
abs="$(realpath -m "$abs")" || fail "cannot resolve path, blocking"
case "$abs" in
  "$root"/*) rel="${abs#"$root"/}";;
  *) fail "subagent '$role' may not write outside the project: $path";;
esac
exec "$root/scripts/check-write-scope.sh" "$role" "$rel"
