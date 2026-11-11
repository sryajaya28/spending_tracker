/* One command after the owner's "Release" (COST_PLAN B2). Replaces the "wait, check, run smoke, write the record" turns.
 *
 *   node tools/ship.js                  find the staging -> main release PR (gh), wait until it is merged, then ship
 *   node tools/ship.js --sha <merge>    the release is already merged (no gh needed): wait for the build and verify
 *   options: --n <release number>  --tests "..."  --gaps "..."  --migrations-applied "..."  --no-record
 *
 * Steps: wait for production to serve the new build stamp (sw.js) -> site answers 200 -> production smoke test only when the release has
 * app code and is not an owner-approved Tier 1 batch (tools/gates.js decides) -> write the release record into docs/RELEASES.md (newest first).
 * Prints one line per step and ends with `SHIP OK` or one `FAIL` line (exit 1; exit 2 when SMOKE_PROD_PASSWORD is missing). It never merges and
 * never touches the database: the owner approves production in GitHub; migrations are applied before (DEV_WORKFLOW.md). Commit the record on your task branch. */
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const g = require('./gates'), { contents } = require('./release_contents');
const PROD = 'https://stiver.io', RECORDS = path.join(g.root, 'docs/RELEASES.md');
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

/* the live stamp (stiver-shell-<10 hex>) matches a sha of any length (7, 10, 40) */
function stampMatches(live, sha) { return !!live && live.slice(13).startsWith(sha.slice(0, live.length - 13)); }
function nextNumber(md) { const n = [...md.matchAll(/^## Release (\d+) contents/gm)].map((m) => +m[1]); return (n.length ? Math.max(...n) : 0) + 1; }
/* put the new block above the newest release (after the intro), never rewrite older ones */
function insertRecord(md, block) { const i = md.search(/^## Release /m); return i < 0 ? md.trimEnd() + '\n\n' + block + '\n' : md.slice(0, i) + block + '\n\n' + md.slice(i); }
const fail = (msg, code) => { console.log('FAIL  ' + msg); process.exit(code || 1); };
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

async function waitMerged() {
  if (spawnSync('gh', ['auth', 'status'], { stdio: 'ignore' }).status !== 0) fail('gh is not signed in: merge the PR in GitHub, then run `node tools/ship.js --sha <merge sha>`');
  for (let i = 0; i < 120; i++) {   // 30 minutes
    const pr = JSON.parse(g.sh('gh pr list --base main --head staging --state all --limit 1 --json number,state,mergeCommit') || '[]')[0];
    if (!pr) fail('no staging -> main pull request found: open one (node tools/release.js --go) or pass --sha');
    if (pr.state === 'MERGED') { console.log(`PASS  PR ${pr.number} merged ${pr.mergeCommit.oid.slice(0, 7)}`); return pr.mergeCommit.oid; }
    if (pr.state === 'CLOSED') fail(`PR ${pr.number} was closed without merging`);
    await sleep(15);
  }
  fail('the release PR was not merged within 30 minutes');
}
async function waitBuild(sha) {
  let live = '';
  for (let i = 0; i < 80; i++) {     // 20 minutes
    live = g.sh(`curl -s --max-time 20 "${PROD}/sw.js?_=${Date.now()}"`).match(/stiver-shell-[0-9a-f]+/)?.[0] || '';
    if (stampMatches(live, sha)) return live;
    await sleep(15);
  }
  fail(`production still serves ${live || 'no build'}, expected stiver-shell-${sha.slice(0, 10)}`);
}
async function main() {
  let sha = arg('--sha');
  g.sh('git fetch -q origin main staging');
  if (!sha) sha = await waitMerged();
  const base = sha + '^1', head = sha + '^2', files = g.changedFiles(base, head), c = g.classify(files, [base, head]);
  const needSmoke = !c.skipTests;
  if (needSmoke && !process.env.SMOKE_PROD_PASSWORD) fail('SMOKE_PROD_PASSWORD is not set (this release has app code, so the smoke test is required)', 2);
  const stamp = await waitBuild(sha); console.log(`PASS  production serves ${stamp}`);
  const code = g.sh(`curl -s -o /dev/null -w "%{http_code}" --max-time 20 ${PROD}/`); if (code !== '200') fail(`${PROD} answers ${code}, expected 200`);
  console.log('PASS  site answers 200');
  let smoke;
  if (needSmoke) {
    const r = spawnSync('node', ['tests/smoke/smoke.js', PROD, '--env', 'production'], { cwd: g.root, encoding: 'utf8', env: { ...process.env, SMOKE_EMAIL: 'smoke.production@stiver.io', SMOKE_PASSWORD: process.env.SMOKE_PROD_PASSWORD } });
    const out = (r.stdout + r.stderr).trim().split('\n');
    if (r.status !== 0) fail('production smoke test: ' + out.slice(-3).join(' | ') + ' (fix at once and release the fix; roll back first if data is affected)');
    smoke = 'production smoke test passed (' + out[out.length - 1] + ')'; console.log('PASS  ' + smoke);
  } else { smoke = 'production smoke test skipped on purpose: ' + (c.docsOnly ? 'docs and tooling only' : 'owner-approved Tier 1 batch'); console.log('SKIP  ' + smoke); }
  if (!process.argv.includes('--no-record')) {
    const n = arg('--n') || nextNumber(fs.readFileSync(RECORDS, 'utf8'));
    const tests = (arg('--tests') || 'see the regression summary') + `; ${PROD} answers 200 and serves ${stamp}`;
    const block = contents(base, head, { n, main: sha.slice(0, 7), tests, smoke, gaps: arg('--gaps'), migrationsApplied: arg('--migrations-applied') });
    fs.writeFileSync(RECORDS, insertRecord(fs.readFileSync(RECORDS, 'utf8'), block));
    console.log(`PASS  release ${n} recorded in docs/RELEASES.md (commit it on your task branch)`);
  }
  console.log('SHIP OK');
}
module.exports = { stampMatches, nextNumber, insertRecord };
if (require.main === module) main().catch((e) => fail(String(e.message || e).split('\n')[0]));
