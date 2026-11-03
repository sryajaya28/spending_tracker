#!/usr/bin/env bash
# SubagentStop hook. Appends one JSON line to logs/agent-runs.jsonl. Never blocks (always exit 0).
# The summary is the first 200 characters of the subagent's final message. Keep secrets out of it.
set -uo pipefail
command -v jq >/dev/null 2>&1 || exit 0
input="$(cat)"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
root="${CLAUDE_PROJECT_DIR:-$here}"
mkdir -p "$root/logs" 2>/dev/null || exit 0
printf '%s' "$input" | jq -c --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{ts:$ts, agent:(.agent_type // "unknown"), feature:null, event:(.hook_event_name // "SubagentStop"), outcome:((.last_assistant_message // "") | .[0:200])}' \
  >> "$root/logs/agent-runs.jsonl" 2>/dev/null
exit 0
