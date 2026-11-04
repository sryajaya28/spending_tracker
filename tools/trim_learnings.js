/* Keeps learning.md short: moves the oldest entries of its "Session log" to docs/learning-archive.md.
 * Lasting lessons belong in the topical sections above the log (promote them first); the log is only a diary.
 *
 *   node tools/trim_learnings.js [keep]     keep = how many newest entries stay in the log (default 4); entries are bullets that start with "- "
 *   node tools/trim_learnings.js --check    print sizes only
 * The integrating agent runs it at merge time (docs/AGENTS.md). Entries are taken in file order: new ones are appended at the end. */
const fs = require('fs'), path = require('path');
const lf = path.join(__dirname, '..', 'learning.md'), af = path.join(__dirname, '..', 'docs', 'learning-archive.md');
const text = fs.readFileSync(lf, 'utf8'), i = text.indexOf('\n## Session log');
if (i < 0) { console.log('no "## Session log" section'); process.exit(1); }
const j = text.indexOf('\n## ', i + 5), headEnd = text.indexOf('\n', i + 1) + 1, tailStart = j < 0 ? text.length : j + 1;
const body = text.slice(headEnd, tailStart), head = text.slice(0, headEnd), tail = text.slice(tailStart);
const lines = body.split('\n'), intro = [], entries = []; let cur = null;
for (const l of lines) { if (/^- /.test(l)) { cur = [l]; entries.push(cur); } else if (cur) cur.push(l); else intro.push(l); }
const keep = process.argv[2] === '--check' ? entries.length : Math.max(1, +process.argv[2] || 4), moved = entries.slice(0, Math.max(0, entries.length - keep)), kept = entries.slice(moved.length);
const size = (f) => fs.statSync(f).size;
console.log(`learning.md: ${size(lf)} chars (~${Math.round(size(lf) / 4)} tokens), session log entries: ${entries.length}`);
if (process.argv[2] === '--check' || !moved.length) { console.log(moved.length ? '' : 'nothing to move'); process.exit(0); }
const join = (es) => es.map((e) => e.join('\n').replace(/\n+$/, '')).join('\n') + '\n';
fs.writeFileSync(af, fs.readFileSync(af, 'utf8').replace(/\n*$/, '\n') + `\n## Moved from learning.md on ${new Date().toISOString().slice(0, 10)}\n\n` + join(moved));
fs.writeFileSync(lf, head + intro.join('\n').replace(/\n*$/, '\n') + join(kept) + (tail ? '\n' + tail : ''));
console.log(`moved ${moved.length} entries to docs/learning-archive.md; learning.md is now ${size(lf)} chars (~${Math.round(size(lf) / 4)} tokens)`);
