const g = require('./gates.js'), assert = require('assert');
g.sh('git fetch -q origin main staging');
const range = ['origin/main', 'origin/staging'], files = g.changedFiles(...range);
// docs-only files never need tests
assert.strictEqual(g.classify(['docs/a.md', 'tools/x.js'], range, []).skipTests, true);
// app code needs tests unless every commit that touched it is on the owner's Tier 1 list
const app = ['prototype/app.js'];
const real = g.sh(`git log --no-merges --format=%H -1 origin/staging -- prototype/app.js`);
assert.strictEqual(g.tierOneBatch(app, range, []), false, 'unapproved app change must not skip');
assert.strictEqual(g.tierOneBatch(['supabase/migrations/20261105000032_x.sql'], range, [real.slice(0, 7)]), false, 'Tier 3 never skips, even when listed');
assert.strictEqual(g.tierOneBatch(['prototype/cloud.js'], range, [real.slice(0, 7)]), false, 'sync code never skips');
console.log('ok gates', files.length, 'files in range');
