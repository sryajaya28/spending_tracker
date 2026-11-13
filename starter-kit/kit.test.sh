#!/usr/bin/env bash
# Self-test of the kit: installs into a throwaway repository and runs the installed tools. bash starter-kit/kit.test.sh
set -euo pipefail
KIT="$(cd "$(dirname "$0")" && pwd)"; T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
bash "$KIT/install.sh" "$T/demo" --name "Demo App" --prod https://demo.example --staging https://staging.demo.example --figma https://figma.example/x --kit-home kit-repo --stack > "$T/log"
cd "$T/demo"
! grep -rIl -E '__(PROJECT|SLUG|APP_DIR|PROD_URL|PROD_HOST|STAGING_URL|STAGING_HOST|FIGMA_URL|KIT_HOME|DATE)__' . || { echo "FAIL placeholders left"; exit 1; }
grep -q '"slug": "demo-app"' tools/kit.config.json && grep -q 'Demo App: instructions' CLAUDE.md
for f in tools/*.js; do node --check "$f"; done
node tools/path_tier.test.js && node tools/ci_wait.test.js && node tools/ship.test.js
[ "$(node tools/path_tier.js --files docs/a.md app/styles.css | tail -1)" = "TIER 1" ] && [ "$(node tools/path_tier.js --files app/x.js supabase/migrations/1.sql | tail -1)" = "TIER 3" ]
git init -q . && git add -A && git -c user.email=t@t -c user.name=t commit -qm init
node -e "const g=require('./tools/gates');const a=g.classify(['docs/a.md','tools/x.js']),b=g.classify(['app/x.js']);if(!a.skipTests||b.skipTests)process.exit(1)"
echo '2026-01-02: **Second.** x' > docs/changes/2026-01-02-b.md && node tools/fold_changes.js >/dev/null && grep -q 'Second' docs/CHANGELOG.md && [ ! -f docs/changes/2026-01-02-b.md ]
node tools/doc_budget.js >/dev/null && node tools/trim_learnings.js --check >/dev/null
out=$(bash tests/run_all.sh 2>&1) || { echo "$out"; exit 1; }; grep -q '^PASS  path_tier (tool)' <<< "$out"
echo custom > CLAUDE.md && out=$(bash "$KIT/install.sh" . --update --stack) && grep -q '0 file(s) added, 1 existing' <<< "$out" && [ "$(cat CLAUDE.md)" = custom ]
bash "$KIT/install.sh" "$T/bare" > /dev/null && [ ! -f "$T/bare/tools/ship.js" ] && grep -q '"appDir": "app"' "$T/bare/tools/kit.config.json" && (cd "$T/bare" && node tools/path_tier.test.js >/dev/null)
echo "ok starter kit ($(find "$KIT/template" -type f | wc -l) template files, $(find "$KIT/stack-supabase-vercel" -type f | wc -l) stack files)"
