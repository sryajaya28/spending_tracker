/* Offline test for tools/ci_wait.js (pure part, no network): node tools/ci_wait.test.js */
const { summarize, failNames, line } = require('./ci_wait.js'), assert = require('assert');
const run = (name, status, conclusion, id) => ({ name, status, conclusion, id });
// the real shape of a Tier 1 PR: e2e skipped on purpose counts as passing
let s = summarize([run('tier', 'completed', 'success', 1), run('e2e', 'completed', 'skipped', 2), run('Vercel Preview Comments', 'completed', 'success', 3)], []);
assert.strictEqual(s.state, 'green');
assert.strictEqual(line(28, s), 'GREEN PR 28: 2 checks passed, 1 skipped (e2e)');
// still running
s = summarize([run('tier', 'completed', 'success', 1), run('e2e', 'in_progress', null, 2)], []);
assert.strictEqual(s.state, 'pending');
assert.strictEqual(line(5, s), 'PENDING PR 5: e2e');
// failed and finished: red; failed while another job still runs: reported failing, but the wait goes on only when nothing else can fail
s = summarize([run('tier', 'completed', 'success', 1), run('e2e', 'completed', 'failure', 2)], []);
assert.strictEqual(s.state, 'red');
assert.strictEqual(line(5, s, ['occtx', 'ios']), 'RED PR 5: e2e failed: occtx, ios');
assert.strictEqual(summarize([run('a', 'completed', 'failure', 1), run('b', 'queued', null, 2)], []).state, 'failing');
// cancelled and timed out are not green; no checks at all is its own state, never green
assert.strictEqual(summarize([run('e2e', 'completed', 'cancelled', 2)], []).state, 'red');
assert.strictEqual(summarize([run('e2e', 'completed', 'timed_out', 2)], []).state, 'red');
assert.strictEqual(summarize([], []).state, 'none');
// legacy commit statuses count too
assert.strictEqual(summarize([run('tier', 'completed', 'success', 1)], [{ context: 'ci/x', state: 'pending' }]).state, 'pending');
assert.strictEqual(summarize([], [{ context: 'ci/x', state: 'failure' }]).state, 'red');
// failing test names from an Actions log (timestamp prefix, de-duplicated, other text ignored)
const log = '2026-11-11T10:00:00.1Z PASS  sample\n2026-11-11T10:00:01.2Z FAIL  occtx\n2026-11-11T10:00:02.3Z FAIL  ios\n2026-11-11T10:00:03.4Z FAIL  occtx\n2026-11-11T10:00:04Z ##[error]Process completed with exit code 1.\n';
assert.deepStrictEqual(failNames(log), ['occtx', 'ios']);
assert.deepStrictEqual(failNames('FAIL  yahoo (python)'), ['yahoo (python)']);
assert.deepStrictEqual(failNames(''), []);
console.log('ok ci_wait');
