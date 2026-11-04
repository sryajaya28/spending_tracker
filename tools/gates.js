/* Shared by tools/release.js and tools/regression.js: is a change "docs only"? A docs-only change (docs, tooling, assistant settings, root *.md)
 * ships no app code, so it needs no regression run and no production smoke test. Anything else (prototype/, tests/, vercel.json, supabase/, ...) does. */
const { execSync } = require('child_process'), path = require('path');
const root = path.join(__dirname, '..');
const DOCS_ONLY = /^(docs\/|tools\/|\.claude\/|[^/]+\.md$)/;
const sh = (c) => execSync(c, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function changedFiles(base, head) { const o = sh(`git diff --name-only ${base} ${head}`); return o ? o.split('\n') : []; }
function classify(files) { const code = files.filter((f) => !DOCS_ONLY.test(f)); return { docsOnly: files.length > 0 && !code.length, code, files }; }
module.exports = { sh, root, changedFiles, classify, DOCS_ONLY };
