/* Size check for the files every session reads first (CLAUDE.md, context.md, learning.md). Exit code 1 when over the budget.
 *   node tools/doc_budget.js            budget 52,000 characters (about 13,000 tokens); override with DOC_BUDGET=chars
 * When it fails: run `node tools/trim_learnings.js`, move finished history out of context.md (changes go to docs/CHANGELOG.md), shorten entries. */
const fs = require('fs'), path = require('path');
const files = ['CLAUDE.md', 'context.md', 'learning.md'], budget = +process.env.DOC_BUDGET || 52000; let total = 0;
for (const f of files) { const n = fs.statSync(path.join(__dirname, '..', f)).size; total += n; console.log(`${f.padEnd(12)} ${String(n).padStart(6)} chars  ~${Math.round(n / 4)} tokens`); }
console.log(`${'total'.padEnd(12)} ${String(total).padStart(6)} chars  ~${Math.round(total / 4)} tokens  (budget ${budget})`);
if (total > budget) { console.log('OVER BUDGET: trim before merging (see the header of this file)'); process.exit(1); }
console.log('within budget');
