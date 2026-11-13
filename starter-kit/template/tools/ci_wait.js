/* Waits for a PR's checks and prints ONE line. Replaces every "check CI" turn (CLAUDE.md rule 6: scripts wait, not you).
 *
 *   node tools/ci_wait.js <pr> [--repo owner/name] [--timeout <minutes, default 20>] [--interval <seconds, default 20>] [--once]
 *
 * Output (one line, last line of stdout):
 *   GREEN PR 28: 3 checks passed, 1 skipped (e2e)
 *   RED PR 28: e2e failed: FAIL occtx, FAIL ios
 *   TIMEOUT PR 28: still running after 20 min: e2e
 *   CLOSED PR 28 / MERGED PR 28 / CONFLICT PR 28 / NOCHECKS PR 28
 * Exit code: 0 green, 1 red, 2 anything else (timeout, conflict, closed, error). --once reads the state a single time and does not wait.
 * Needs the GitHub CLI signed in (`gh`), like tools/release.js. A skipped check counts as passing (the e2e job is skipped for Tier 1 on purpose, ci.yml).
 * A newer push restarts the wait on the new head commit. The repo defaults to the `origin` remote. */
const { spawnSync } = require('child_process');

/* ---- pure part (tested in tools/ci_wait.test.js) ---- */
const BAD = new Set(['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure', 'stale']);
const GOOD = new Set(['success', 'skipped', 'neutral']);
/* runs = check_runs from the REST API; statuses = legacy commit statuses ({context, state}). Returns the overall state and the names behind it. */
function summarize(runs, statuses) {
  const items = [
    ...runs.map((r) => ({ name: r.name, id: r.id, done: r.status === 'completed', result: r.conclusion || null })),
    ...(statuses || []).map((s) => ({ name: s.context, id: null, done: s.state !== 'pending', result: s.state === 'success' ? 'success' : s.state === 'pending' ? null : 'failure' })),
  ];
  const failed = items.filter((i) => i.done && BAD.has(i.result)), pending = items.filter((i) => !i.done);
  const skipped = items.filter((i) => i.done && i.result === 'skipped'), passed = items.filter((i) => i.done && GOOD.has(i.result) && i.result !== 'skipped');
  const state = !items.length ? 'none' : failed.length ? (pending.length ? 'failing' : 'red') : pending.length ? 'pending' : 'green';
  return { state, failed, pending, skipped, passed, total: items.length };
}
/* test names from a job log: the suite prints "FAIL  <name>" (tests/e2e/run_all.sh); log lines carry a timestamp prefix */
function failNames(log) {
  const out = [];
  for (const line of String(log || '').split('\n')) { const m = line.match(/(?:^|\s)FAIL\s+(\S.*?)\s*$/); if (m && !out.includes(m[1])) out.push(m[1]); }
  return out;
}
function line(pr, s, extra) {
  const n = (a) => a.map((i) => i.name).join(', ');
  if (s.state === 'green') return `GREEN PR ${pr}: ${s.passed.length} check${s.passed.length === 1 ? '' : 's'} passed` + (s.skipped.length ? `, ${s.skipped.length} skipped (${n(s.skipped)})` : '');
  if (s.state === 'red' || s.state === 'failing') return `RED PR ${pr}: ${n(s.failed)} failed` + (extra && extra.length ? ': ' + extra.join(', ') : '') + (s.pending.length ? ` (still running: ${n(s.pending)})` : '');
  return `PENDING PR ${pr}: ${n(s.pending)}`;
}
module.exports = { summarize, failNames, line };

/* ---- gh calls ---- */
if (require.main === module) {
  const argv = process.argv.slice(2), val = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
  const pr = argv.find((a, i) => /^\d+$/.test(a) && !['--timeout', '--interval'].includes(argv[i - 1]));
  const once = argv.includes('--once'), timeoutMin = Number(val('--timeout', 20)), intervalSec = Number(val('--interval', 20));
  const done = (code, msg) => { console.log(msg); process.exit(code); };
  if (!pr) done(2, 'ERROR usage: node tools/ci_wait.js <pr number> [--repo owner/name] [--timeout minutes] [--interval seconds] [--once]');
  const gh = (args) => { const r = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); if (r.error || r.status !== 0) throw new Error(((r.stderr || '') + (r.error ? r.error.message : '')).trim().split('\n')[0] || 'gh failed'); return r.stdout; };
  const api = (p) => JSON.parse(gh(['api', p, '--paginate', '--slurp']).replace(/^$/, '[]'));
  const repo = val('--repo', null) || (() => { const m = spawnSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).stdout.match(/github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\s*$/); return m && m[1]; })();
  if (!repo) done(2, 'ERROR no repo: pass --repo owner/name');
  const sleep = (s) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, s * 1000);
  const start = Date.now(), firstSeen = {};
  try {
    for (;;) {
      const p = JSON.parse(gh(['api', `repos/${repo}/pulls/${pr}`]));
      if (p.merged) done(2, `MERGED PR ${pr}`);
      if (p.state === 'closed') done(2, `CLOSED PR ${pr}`);
      const sha = p.head.sha, runs = api(`repos/${repo}/commits/${sha}/check-runs?per_page=100`).flatMap((x) => x.check_runs);
      const statuses = api(`repos/${repo}/commits/${sha}/status`).flatMap((x) => x.statuses || []);
      const s = summarize(runs, statuses);
      if (s.state === 'green' || s.state === 'red') {
        let names = [];
        for (const f of s.failed) if (f.id && !names.length) { try { names = failNames(gh(['api', `repos/${repo}/actions/jobs/${f.id}/logs`])); } catch (e) { /* not an Actions job, or logs expired: report the check name only */ } }
        done(s.state === 'green' ? 0 : 1, line(pr, s, names));
      }
      firstSeen[sha] = firstSeen[sha] || Date.now();
      if (s.state === 'none' && p.mergeable_state === 'dirty') done(2, `CONFLICT PR ${pr}: merge conflict with ${p.base.ref}, so no checks run; rebase or merge ${p.base.ref} and push`);
      if (s.state === 'none' && Date.now() - firstSeen[sha] > 3 * 60 * 1000) done(2, `NOCHECKS PR ${pr}: no checks started within 3 minutes of the latest push (${sha.slice(0, 7)})`);
      if (once) done(2, s.state === 'none' ? `PENDING PR ${pr}: no checks yet` : line(pr, s));
      if (Date.now() - start > timeoutMin * 60 * 1000) done(2, `TIMEOUT PR ${pr}: still running after ${timeoutMin} min: ${s.pending.map((i) => i.name).join(', ') || 'no checks yet'}`);
      sleep(intervalSec);
    }
  } catch (e) { done(2, `ERROR PR ${pr}: ${e.message}`); }
}
