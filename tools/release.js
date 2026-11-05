/* One-command release: staging -> main by pull request, wait for the new build, production smoke test (skipped for docs/tooling-only changes).
 *
 *   node tools/release.js            dry run: shows what would ship and which checks apply
 *   node tools/release.js --go       does it. Only run with --go after the owner said "release" (CLAUDE.md rule 6b).
 *
 * Needs `gh` signed in (or do the PR by hand and use --verify-only <sha>) and SMOKE_PROD_PASSWORD for the smoke test.
 * Migrations are never applied here: apply them first (staging database, then production) as DEV_WORKFLOW.md says. */
const { spawnSync } = require('child_process'), g = require('./gates'), { contents } = require('./release_contents');
const go = process.argv.includes('--go'), vi = process.argv.indexOf('--verify-only');
const PROD = 'https://stiver.io';
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
async function verify(sha, docsOnly) {
  const short = sha.slice(0, 10); let live = '';
  for (let i = 0; i < 40; i++) {
    live = g.sh(`curl -s "${PROD}/sw.js?_=${Date.now()}"`).match(/stiver-shell-[0-9a-f]+/)?.[0] || '';
    if (live.endsWith(short)) break; await sleep(15);
  }
  if (!live.endsWith(short)) { console.log(`FAIL  production still serves ${live || 'no build'}, expected stiver-shell-${short}`); process.exit(1); }
  console.log(`PASS  production serves ${live}`);
  if (docsOnly) { console.log('SKIPPED production smoke test: docs/tooling only, no app code shipped.'); return; }
  if (!process.env.SMOKE_PROD_PASSWORD) { console.log('SMOKE_PROD_PASSWORD is not set'); process.exit(2); }
  const r = spawnSync('node', ['tests/smoke/smoke.js', PROD, '--env', 'production'], { cwd: g.root, encoding: 'utf8', env: { ...process.env, SMOKE_EMAIL: 'smoke.production@stiver.io', SMOKE_PASSWORD: process.env.SMOKE_PROD_PASSWORD } });
  console.log((r.stdout + r.stderr).split('\n').slice(-4).join('\n'));
  if (r.status !== 0) { console.log('FAIL  production smoke test: fix at once and release the fix (roll back first if data is affected)'); process.exit(1); }
}
(async () => {
  if (vi > 0) { const sha = process.argv[vi + 1]; g.sh('git fetch -q origin main'); const d = g.classify(g.changedFiles(sha + '^1', sha)).docsOnly; await verify(sha, d); console.log('\n' + contents(sha + '^1', sha + '^2', { main: sha.slice(0, 7), tests: d ? 'regression and production smoke skipped on purpose (docs and tooling only)' : 'see the regression summary and the smoke result above' })); return; }
  g.sh('git fetch -q origin main staging');
  const files = g.changedFiles('origin/main', 'origin/staging'), c = g.classify(files);
  if (!files.length) { console.log('Nothing to release: staging equals main.'); return; }
  const mig = files.filter((f) => /^supabase\/migrations\//.test(f));
  console.log(`${files.length} files change (${c.code.length} outside docs/tooling). ${c.docsOnly ? 'Docs/tooling only: no regression, no production smoke test.' : 'App code: regression and production smoke test apply.'}`);
  if (mig.length) console.log(`MIGRATIONS in this release (apply to staging, then production, BEFORE merging): ${mig.join(', ')}`);
  console.log('\n' + contents('origin/main', 'origin/staging', {}));   // the exact contents the owner approves (never a summary)
  if (!go) { console.log('Dry run. Add --go to open the PR, merge it and verify.'); return; }
  if (mig.length) { console.log('Refusing: apply the migrations first, then rerun with --go --migrations-applied.'); if (!process.argv.includes('--migrations-applied')) process.exit(1); }
  if (spawnSync('gh', ['auth', 'status']).status !== 0) { console.log('gh is not signed in here: open and merge the PR another way (the GitHub MCP tools), then run: node tools/release.js --verify-only <merge sha>'); process.exit(1); }
  const pr = g.sh(`gh pr create --base main --head staging --title "Release: ${files.length} files" --body "Release by tools/release.js. ${c.docsOnly ? 'Docs/tooling only.' : 'Regression passed on staging.'}"`).split('\n').pop();
  console.log('PR ' + pr);
  g.sh(`gh pr merge ${pr} --merge`);
  const sha = g.sh('gh pr view ' + pr + ' --json mergeCommit -q .mergeCommit.oid');
  console.log('merged ' + sha.slice(0, 7));
  await verify(sha, c.docsOnly);
  console.log('RELEASE DONE');
})();
