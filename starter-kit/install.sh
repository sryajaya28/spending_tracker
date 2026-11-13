#!/usr/bin/env bash
# Copies the starter kit into a repository. Never overwrites: existing files are kept and listed. Safe to run again.
#
#   bash starter-kit/install.sh <target-repo-dir> [--name "My App"] [--slug myapp] [--app-dir app]
#        [--prod https://myapp.com] [--staging https://staging.myapp.com] [--figma <url>] [--kit-home <where the kit lives>]
#        [--stack]     also copy the Supabase + Vercel + browser-test pack (stack-supabase-vercel/)
#        [--update]    same run, for a repository that already has the kit: adds what is missing, lists what differs
#
# A value you do not give stays as a __PLACEHOLDER__ in the files; run again with the flag later to fill it.
set -euo pipefail
KIT="$(cd "$(dirname "$0")" && pwd)"
[ $# -ge 1 ] || { sed -n 2,9p "$0"; exit 2; }
TARGET="$(mkdir -p "$1" && cd "$1" && pwd)"; shift
NAME=""; SLUG=""; APP=""; PROD=""; STG=""; FIGMA=""; HOME_="" ; STACK=0
while [ $# -gt 0 ]; do case "$1" in
  --name) NAME="$2"; shift 2;; --slug) SLUG="$2"; shift 2;; --app-dir) APP="${2%/}"; shift 2;; --prod) PROD="${2%/}"; shift 2;;
  --staging) STG="${2%/}"; shift 2;; --figma) FIGMA="$2"; shift 2;; --kit-home) HOME_="$2"; shift 2;; --stack) STACK=1; shift;; --update) shift;;
  *) echo "unknown option: $1"; exit 2;; esac; done
first=0; [ -f "$TARGET/tools/kit.config.json" ] || first=1
if [ $first = 1 ]; then   # first install: sensible defaults for the names
  [ -n "$NAME" ] || NAME="$(basename "$TARGET")"
  [ -n "$SLUG" ] || SLUG="$(echo "$NAME" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//; s/-$//')"
  [ -n "$APP" ] || APP="app"
fi
added=0; kept=(); files=()
copy_tree() { # $1 = source folder inside the kit
  while IFS= read -r -d '' f; do
    rel="${f#"$1"/}"; files+=("$rel"); dest="$TARGET/$rel"
    if [ -e "$dest" ]; then cmp -s "$f" "$dest" || kept+=("$rel"); else mkdir -p "$(dirname "$dest")"; cp "$f" "$dest"; added=$((added + 1)); fi
  done < <(find "$1" -type f ! -name 'README.stack.md' -print0 | sort -z)
}
copy_tree "$KIT/template"
[ $STACK = 1 ] && copy_tree "$KIT/stack-supabase-vercel"
fill() { # $1 placeholder, $2 value: only in files this kit installs, only when a value was given
  [ -n "$2" ] || return 0
  for rel in "${files[@]}"; do p="$TARGET/$rel"; [ -f "$p" ] && grep -q "$1" "$p" 2>/dev/null && V="$2" perl -pi -e "s/\Q$1\E/\$ENV{V}/g" "$p"; done; return 0
}
host() { echo "$1" | sed -E 's#^https?://##; s#/.*$##'; }
fill __PROJECT__ "$NAME"; fill __SLUG__ "$SLUG"; fill __APP_DIR__ "$APP"; fill __FIGMA_URL__ "$FIGMA"; fill __KIT_HOME__ "$HOME_"
fill __STAGING_URL__ "$STG"; fill __STAGING_HOST__ "$(host "$STG")"; fill __PROD_URL__ "$PROD"; fill __PROD_HOST__ "$(host "$PROD")"
[ $first = 1 ] && fill __DATE__ "$(date +%Y-%m-%d)"
chmod +x "$TARGET/tests/run_all.sh" 2>/dev/null || true
echo "starter kit -> $TARGET: $added file(s) added, ${#kept[@]} existing file(s) kept unchanged"
[ ${#kept[@]} -gt 0 ] && { echo "kept (differ from the kit; merge by hand if you want the kit's version):"; printf '  %s\n' "${kept[@]}"; }
left=$(cd "$TARGET" && grep -rhoE '__[A-Z]+(_[A-Z]+)*__' "${files[@]}" 2>/dev/null | grep -vE '^__(BUILD|pycache)__$' | sort | uniq -c | sort -rn || true)
[ -n "$left" ] && { echo "placeholders still to fill (run again with the matching flag, or edit by hand):"; echo "$left"; }
echo "next: open starter-kit/BOOTSTRAP.md (or give it to the first session in the new repository)"
