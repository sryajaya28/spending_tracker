#!/usr/bin/env bash
# Pure function: guard-prod.sh "<command string>" exits 2 if the command matches a production marker.
# The hook wrapper (added after hook schema is verified) extracts the command from stdin and calls this.
set -uo pipefail
cmd="${1:-}"
# Documented exception E1 (docs/team-exceptions.md): the existing production smoke test, exact command only.
norm="$(printf '%s' "$cmd" | tr '\n' ' ' | sed -E 's/\\ +/ /g; s/ +/ /g; s/^ //; s/ $//')"
smoke='^SMOKE_EMAIL=smoke\.production@stiver\.io SMOKE_PASSWORD="\$SMOKE_PROD_PASSWORD" node tests/smoke/smoke\.js https://stiver\.io --env production$'
if [[ "$norm" =~ $smoke ]]; then exit 0; fi
root="$(cd "$(dirname "$0")/.." && pwd)"
markers="$root/docs/engineering-standards/prod-markers.txt"
[ -f "$markers" ] || { echo "guard-prod: markers file missing, blocking" >&2; exit 2; }
while IFS= read -r pat; do
  case "$pat" in ''|'#'*) continue;; esac
  if printf '%s' "$cmd" | grep -Eiq -- "$pat"; then
    echo "guard-prod: blocked, command matches production marker: $pat" >&2
    exit 2
  fi
done < "$markers"
exit 0
