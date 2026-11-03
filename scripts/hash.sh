#!/usr/bin/env bash
# Usage: scripts/hash.sh <file>...        prints "<sha256>  <path>" per file
#        scripts/hash.sh --bundle <file>... prints one sha256 over the sorted per-file hashes
# Hash is over raw file bytes. Any change, including whitespace, changes the hash.
set -euo pipefail
bundle=0
if [ "${1:-}" = "--bundle" ]; then bundle=1; shift; fi
[ "$#" -gt 0 ] || { echo "usage: hash.sh [--bundle] <file>..." >&2; exit 2; }
for f in "$@"; do [ -f "$f" ] || { echo "missing file: $f" >&2; exit 1; }; done
if [ "$bundle" = 1 ]; then
  for f in "$@"; do printf '%s  %s\n' "$(shasum -a 256 "$f" | cut -d' ' -f1)" "$f"; done | LC_ALL=C sort -k2 | shasum -a 256 | cut -d' ' -f1
else
  for f in "$@"; do printf '%s  %s\n' "$(shasum -a 256 "$f" | cut -d' ' -f1)" "$f"; done
fi
