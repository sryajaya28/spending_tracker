/* Folds the per-change files in docs/changes/*.md into docs/CHANGELOG.md (newest first) and deletes them.
 * Only the integrating agent runs this, at merge/release time, so two agents never edit CHANGELOG.md at once.
 *   node tools/fold_changes.js */
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'docs', 'changes'), log = path.join(__dirname, '..', 'docs', 'CHANGELOG.md');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md').sort().reverse() : [];
if (!files.length) { console.log('no change files'); process.exit(0); }
const entries = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8').trim().replace(/\n+/g, ' ')).map((l) => (l.startsWith('- ') ? l : '- ' + l));
const s = fs.readFileSync(log, 'utf8'), i = s.indexOf('\n- ');
fs.writeFileSync(log, s.slice(0, i) + '\n' + entries.join('\n') + s.slice(i));
files.forEach((f) => fs.unlinkSync(path.join(dir, f)));
console.log('folded ' + files.length + ' change file(s) into docs/CHANGELOG.md');
