/* Which browser tests does a change need? Reads tests/e2e/affects.json (rules) and the git diff, and prints the run_all.sh command.
 *
 *   node tools/affected_tests.js                  your branch against origin/staging (committed and uncommitted changes)
 *   node tools/affected_tests.js --commit <sha>   one commit
 *   node tools/affected_tests.js --files a b c    named files (no diff text, so only path rules apply)
 *   node tools/affected_tests.js --verify [n]     check the rules against the last n commits that changed both app code and tests
 *
 * It is a shortcut for the time you are building. The whole suite (`bash tests/e2e/run_all.sh`, about a minute) still runs once before you push. */
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const root = path.join(__dirname, '..'), cfg = JSON.parse(fs.readFileSync(path.join(root, 'tests/e2e/affects.json'), 'utf8'));
const sh = (c) => execSync(c, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] });
const allTests = ((/&& tests=\(([^)]*)\)/.exec(fs.readFileSync(path.join(root, 'tests/e2e/run_all.sh'), 'utf8')) || [])[1] || '').split(/\s+/).filter(Boolean);
if (!allTests.length) { console.log('cannot read the test list from tests/e2e/run_all.sh'); process.exit(2); }
const APP = /^(__APP_DIR__\/(app|app\/[\w-]+|sample|dropdown|datepicker|analytics|i18n(-id)?)\.js|__APP_DIR__\/styles\.css)$/;
function plan(files0, diffText) {
  // a change that only bumps the service-worker cache name (older commits did this by hand) is not a shared-file change
  const swBump = /^[+-]const CACHE =/m.test(diffText || '') && !/^[+-]const SHELL/m.test(diffText || ''), files = swBump ? files0.filter((f) => f !== '__APP_DIR__/sw.js') : files0;
  const why = [], pick = new Set(cfg.always);
  for (const f of files) { const m = /^tests\/e2e\/([\w-]+)\.js$/.exec(f); if (m && allTests.includes(m[1])) { pick.add(m[1]); why.push(`${f} changed: runs itself`); } }
  const full = files.filter((f) => cfg.fullSuiteFiles.some((r) => new RegExp(r).test(f)));
  const appFiles = files.filter((f) => APP.test(f));
  if (!appFiles.length && !full.length) return { mode: files.some((f) => /^tests\//.test(f)) ? 'tests' : 'none', tests: [...pick].filter((t) => files.some((f) => f === `tests/e2e/${t}.js`)), why: why.length ? why : ['no app, style or data-layer file changed: no browser tests needed'] };
  if (full.length) return { mode: 'full', tests: allTests, why: [`shared file changed (${full.slice(0, 3).join(', ')}): run the whole suite`] };
  const lines = (diffText || '').split('\n').filter((l) => /^[+-][^+-]/.test(l)).join('\n');
  let hit = 0;
  for (const r of cfg.rules) {
    const byFile = (r.files || []).some((rx) => files.some((f) => new RegExp(rx).test(f)));
    const byDiff = (r.diff || []).some((rx) => new RegExp(rx, 'i').test(lines));
    if (byFile || byDiff) { hit++; r.tests.forEach((t) => pick.add(t)); why.push(`${r.name}: ${r.tests.join(' ')}`); }
  }
  if (!hit) return { mode: 'full', tests: allTests, why: ['changed app code matches no rule: run the whole suite (add a rule to tests/e2e/affects.json)'] };
  return { mode: 'subset', tests: allTests.filter((t) => pick.has(t)), why };
}
const arg = process.argv.slice(2);
// only the app files' changed lines are searched for words (docs, tests and design files would match almost every rule)
const DIFF_PATHS = '__APP_DIR__/app.js __APP_DIR__/app/ __APP_DIR__/sample.js __APP_DIR__/dropdown.js __APP_DIR__/datepicker.js __APP_DIR__/analytics.js __APP_DIR__/i18n.js __APP_DIR__/i18n-id.js __APP_DIR__/styles.css __APP_DIR__/sw.js';
function fromGit(args) { const names = sh(`git diff --name-only ${args}`).split('\n').filter(Boolean); return { files: names, diff: sh(`git diff -U0 ${args} -- ${DIFF_PATHS}`) }; }
if (arg[0] === '--verify') {
  const n = +arg[1] || 60, shas = sh("git log --no-merges --format=%H -n 600").split('\n').filter(Boolean); let seen = 0, ok = 0, over = 0; const miss = [], sizes = [];
  for (const sha of shas) {
    if (seen >= n) break; let g; try { g = fromGit(`${sha}^ ${sha}`); } catch (e) { continue; } const { files, diff } = g;
    const touchedTests = files.map((f) => (/^tests\/e2e\/([\w-]+)\.js$/.exec(f) || [])[1]).filter((t) => t && allTests.includes(t));
    if (!touchedTests.length || !files.some((f) => APP.test(f))) continue; seen++;
    const p = plan(files.filter((f) => !/^tests\//.test(f)), diff), got = new Set(p.tests), lost = touchedTests.filter((t) => !got.has(t));
    if (!lost.length) ok++; else miss.push(`${sha.slice(0, 7)} missed ${lost.join(',')}  (suggested ${p.mode}: ${p.tests.length} tests)`);
    over += p.tests.length; sizes.push(p.tests.length);
  }
  sizes.sort((a, b) => a - b); console.log(`${ok}/${seen} commits: every test the author changed was in the suggestion; suggestion size: median ${sizes[Math.floor(sizes.length / 2)]}, average ${seen ? Math.round(over / seen) : 0} of ${allTests.length} tests`);
  miss.forEach((m) => console.log('  ' + m)); process.exit(0);
}
let src;
if (arg[0] === '--files') src = { files: arg.slice(1), diff: '' };
else if (arg[0] === '--commit') src = fromGit(`${arg[1]}^ ${arg[1]}`);
else { let base = 'origin/staging'; try { base = sh(`git merge-base HEAD origin/staging`).trim(); } catch (e) { /* no origin/staging */ } src = fromGit(base); }
const p = plan(src.files, src.diff);
console.log(`changed files: ${src.files.length}\nmode: ${p.mode}`); p.why.forEach((w) => console.log('  - ' + w));
if (p.mode === 'none') console.log('\nnothing to run');
else if (p.mode === 'full') console.log('\nbash tests/e2e/run_all.sh');
else console.log(`\nbash tests/e2e/run_all.sh ${p.tests.join(' ')}   # ${p.tests.length} of ${allTests.length} tests; the whole suite still runs once before you push`);
