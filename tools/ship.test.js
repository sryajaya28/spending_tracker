/* Offline test for the pure parts of tools/ship.js: node tools/ship.test.js */
const assert = require('assert'), { stampMatches, nextNumber, insertRecord } = require('./ship');
assert(stampMatches('stiver-shell-b01c36a0f5', 'b01c36a'), '7-character sha');
assert(stampMatches('stiver-shell-b01c36a0f5', 'b01c36a0f5d2e4aa11'), 'long sha');
assert(!stampMatches('stiver-shell-b01c36a0f5', '8f4a1ec'), 'other build');
assert(!stampMatches('', 'b01c36a'), 'no build served');
const md = '# Release contents\n\nintro\n\n## Release 18 contents (main b01c36a)\n\nx\n\n## Release 17 contents (main 8f4a1ec)\n\ny\n';
assert.strictEqual(nextNumber(md), 19); assert.strictEqual(nextNumber('# none'), 1);
const out = insertRecord(md, '## Release 19 contents (main abc1234)\n\nz');
assert(out.indexOf('Release 19') < out.indexOf('Release 18') && out.indexOf('intro') < out.indexOf('Release 19'), 'newest first, intro kept');
assert(out.includes('Release 17') && out.endsWith('y\n'), 'older records untouched');
console.log('ok ship');
