/* The path rule of the risk-tiered workflow (docs/workflows/README.md): the MINIMUM tier of a change, from the files it touches.
 * An agent may raise a tier, never lower it. The highest tier of any file wins. Rules live in tools/kit.config.json (tierRules), checked top-down, first match per file.
 *
 *   node tools/path_tier.js [base] [head]     files from `git diff --name-only base head` (default origin/main..HEAD)
 *   node tools/path_tier.js --files a b c     explicit list
 * Prints one line per file and a final "TIER n". Exit code is always 0 (CI reads --json). --json prints {tier, files}. */
const { execSync } = require('child_process');
const RULES = require('./kit.config.json').tierRules.map(([t, re, why]) => [t, new RegExp(re), why]);
function tierOf(file) { for (const [t, re, why] of RULES) if (re.test(file)) return { tier: t, why }; return { tier: 2, why: 'unknown path: Tier 2 until classified' }; }
function classify(files) {
  const rows = files.map((f) => ({ file: f, ...tierOf(f) }));
  return { tier: rows.reduce((m, r) => Math.max(m, r.tier), 1), files: rows };
}
module.exports = { classify, tierOf };
if (require.main === module) {
  const a = process.argv.slice(2), json = a.includes('--json'), rest = a.filter((x) => x !== '--json');
  const files = rest[0] === '--files' ? rest.slice(1) : execSync(`git diff --name-only ${rest[0] || 'origin/main'} ${rest[1] || 'HEAD'}`, { encoding: 'utf8' }).split('\n').filter(Boolean);
  const r = classify(files);
  if (json) console.log(JSON.stringify(r));
  else { r.files.forEach((f) => console.log(`T${f.tier}  ${f.file}  (${f.why})`)); console.log(`TIER ${r.tier}`); }
}
