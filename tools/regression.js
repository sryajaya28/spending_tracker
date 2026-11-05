/* One-command regression of staging. Skips itself when the change since production is docs/tooling only or a Tier 1 batch (tools/gates.js).
 *
 *   node tools/regression.js [--force]       needs SMOKE_STAGING_PASSWORD in the environment
 *
 * Runs: the whole browser suite, the staging smoke test, the real-database regression (create, then cleanup).
 * Prints the regression summary block (docs/DEV_WORKFLOW.md section 3) with what ran and what passed. Exit 0 = all passed or skipped. */
const { spawnSync } = require('child_process'), g = require('./gates');
const force = process.argv.includes('--force'), STG = 'https://staging.stiver.io';
g.sh('git fetch -q origin main staging');
const c = g.classify(g.changedFiles('origin/main', 'origin/staging'), ['origin/main', 'origin/staging']);
if (!c.files.length) { console.log('REGRESSION SKIPPED: staging has no changes against main.'); process.exit(0); }
if (c.skipTests && !force) { console.log(c.docsOnly ? `REGRESSION SKIPPED: docs/tooling only (${c.files.length} files, no app code). Use --force to run anyway.` : `REGRESSION SKIPPED: Tier 1 batch (every app change is listed in docs/workflows/tier1-approved.txt; CI e2e and the owner's screenshot review are the gates). Use --force to run anyway.`); process.exit(0); }
if (!process.env.SMOKE_STAGING_PASSWORD) { console.log('SMOKE_STAGING_PASSWORD is not set'); process.exit(2); }
const env = { ...process.env, SMOKE_EMAIL: 'smoke.staging@stiver.io', SMOKE_PASSWORD: process.env.SMOKE_STAGING_PASSWORD };
const steps = [
  ['browser suite (all tests)', 'bash', ['tests/e2e/run_all.sh']],
  ['staging smoke test', 'node', ['tests/smoke/smoke.js', STG, '--env', 'staging']],
  ['real-database regression: create', 'node', ['tests/staging/regression.js', STG, 'create']],
  ['real-database regression: cleanup', 'node', ['tests/staging/regression.js', STG, 'cleanup']],
];
const res = [];
for (const [name, cmd, args] of steps) {
  const r = spawnSync(cmd, args, { cwd: g.root, env, encoding: 'utf8', maxBuffer: 1 << 28 });
  const out = (r.stdout || '') + (r.stderr || ''), bad = (out.match(/^FAIL.*$/gm) || []);
  const ok = r.status === 0 && !bad.length; res.push({ name, ok, bad });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); bad.slice(0, 10).forEach((b) => console.log('      ' + b));
  if (!ok && name.startsWith('real-database regression: create')) { /* still clean up the records it made */ }
  if (!ok && !name.includes('create')) break;
}
const failed = res.filter((x) => !x.ok);
console.log(`\nREGRESSION SUMMARY\n  changed since production: ${c.files.length} files (${c.code.length} outside docs/tooling)\n  ran: ${res.map((x) => x.name).join('; ')}\n  result: ${failed.length ? 'FAILED: ' + failed.map((x) => x.name).join(', ') : 'all passed'}\n  recommendation: ${failed.length ? 'do not release' : 'release'}`);
process.exit(failed.length ? 1 : 0);
