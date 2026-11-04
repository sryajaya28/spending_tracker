/* Stamps the service worker's cache name with the build id, so nobody edits a version number by hand (two agents
 * bumping the same line used to conflict). Run by Vercel as the build command (see vercel.json); locally the
 * placeholder stays as it is and the cache is simply called "stiver-shell-__BUILD__".
 *   node tools/stamp_sw.js            (uses VERCEL_GIT_COMMIT_SHA, else the current git commit, else a timestamp) */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const file = path.join(__dirname, '..', 'prototype', 'sw.js');
let id = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 10);
if (!id) { try { id = cp.execSync('git rev-parse --short=10 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { id = 'b' + Date.now().toString(36); } }
const s = fs.readFileSync(file, 'utf8');
if (!s.includes('__BUILD__')) { console.error('stamp_sw: no __BUILD__ placeholder in prototype/sw.js'); process.exit(1); }
fs.writeFileSync(file, s.replace('__BUILD__', id));
console.log('service worker cache: stiver-shell-' + id);
