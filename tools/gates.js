/* Shared by tools/release.js and tools/regression.js: is a change "docs only"? A docs-only change (docs, tooling, assistant settings, root *.md)
 * ships no app code, so it needs no regression run and no production smoke test. Anything else (prototype/, tests/, vercel.json, supabase/, ...) does. */
const { execSync } = require('child_process'), path = require('path');
const root = path.join(__dirname, '..');
const DOCS_ONLY = /^(docs\/|tools\/|\.claude\/|[^/]+\.md$)/;
const sh = (c) => execSync(c, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function changedFiles(base, head) { const o = sh(`git diff --name-only ${base} ${head}`); return o ? o.split('\n') : []; }
/* Tier 1 (docs/workflows/TIER_1.md): the owner may lower an app change (icon, copy, spacing) from the path rule's Tier 2 to Tier 1. Such commits are listed in
 * docs/workflows/tier1-approved.txt (short sha first, then the owner's words); the Tech-Lead adds a line only when the owner says so. A release whose non-docs
 * files were changed ONLY by listed commits, and whose files are never Tier 3 (database, sync, config, functions), needs no regression run and no production smoke test. */
const fs = require('fs');
function tier1Approved() { try { return fs.readFileSync(path.join(root, 'docs/workflows/tier1-approved.txt'), 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('#')).map((l) => l.trim().split(/\s+/)[0]); } catch (e) { return []; } }
function tierOneBatch(code, range, approved) {
  if (!code.length || !range) return false;
  const { classify: tierOf } = require('./path_tier');
  if (tierOf(code).tier >= 3) return false;
  const shas = sh(`git log --no-merges --format=%H ${range[0]}..${range[1]} -- ${code.map((f) => JSON.stringify(f)).join(' ')}`).split('\n').filter(Boolean);
  const ok = approved || tier1Approved();
  return shas.length > 0 && shas.every((h) => ok.some((a) => h.startsWith(a)));
}
/* range = [base, head] lets classify look at the commits; skipTests = docs/tooling only OR a Tier 1 batch */
function classify(files, range, approved) {
  const code = files.filter((f) => !DOCS_ONLY.test(f)), docsOnly = files.length > 0 && !code.length;
  const tier1 = !docsOnly && tierOneBatch(code, range, approved);
  return { docsOnly, tier1, skipTests: docsOnly || tier1, code, files };
}
module.exports = { sh, root, changedFiles, classify, tierOneBatch, tier1Approved, DOCS_ONLY };
