/* Exact contents of a release (owner, 2026-11-05: "show exactly what's inside the release"). Never a summary: every commit, every file, migrations, what a user can see.
 *
 *   node tools/release_contents.js                      what the next release would contain (origin/main..origin/staging)
 *   node tools/release_contents.js --merge <sha>        what a past release (a merge commit on main) contained
 *   optional notes the script cannot know: --n <release number> --tests "..." --smoke "..." --gaps "..." --migrations-applied "..."
 *
 * Prints markdown. tools/release.js prints it in the dry run and after a release; the integrator posts it to the Workspace (channel releases,
 * to owner) and appends it to docs/RELEASES.md. */
const g = require('./gates');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const USER_VISIBLE = /^(prototype\/|api\/|vercel\.json$|supabase\/migrations\/)/;
const AREAS = [['App (what users see)', /^prototype\//], ['Database migrations', /^supabase\/migrations\//], ['Edge Functions', /^supabase\/functions\//], ['API and hosting', /^(api\/|vercel\.json$)/],
  ['Tests', /^tests\//], ['Tooling', /^tools\//], ['Docs and rules', /^(docs\/|[^/]+\.md$)/], ['Assistant settings', /^\.claude\//]];

function contents(from, to, o) {
  o = o || {};
  const files = g.sh(`git diff --name-only ${from} ${to}`).split('\n').filter(Boolean);
  const commits = g.sh(`git log --no-merges --format=%h%x09%s ${from}..${to}`).split('\n').filter(Boolean).map((l) => l.split('\t'));
  // plain-words lines: the changelog lines this release added
  const added = g.sh(`git diff ${from} ${to} -- docs/CHANGELOG.md`).split('\n').filter((l) => /^\+- 20\d\d-/.test(l)).map((l) => l.slice(3));
  const visible = files.filter((f) => USER_VISIBLE.test(f) && !/^supabase\/migrations\//.test(f));
  const migrations = files.filter((f) => /^supabase\/migrations\//.test(f));
  const out = [];
  out.push(`## Release ${o.n ? o.n + ' ' : ''}contents${o.main ? ' (main ' + o.main + ')' : ''}`);
  out.push(`Range: ${g.sh('git rev-parse --short ' + from)}..${g.sh('git rev-parse --short ' + to)}. ${commits.length} commits, ${files.length} files.`);
  out.push('', '**What changed, in plain words** (from the changelog lines this release added)');
  out.push(...(added.length ? added.map((l) => '- ' + l.replace(/\*\*/g, '')) : ['- (no changelog line added: say what changed here)']));
  out.push('', '**What a user can see change**');
  out.push(visible.length ? `Yes: ${visible.length} app files changed (${visible.slice(0, 8).join(', ')}${visible.length > 8 ? ', ...' : ''}).` : 'Nothing: docs, tooling and settings only. The app and its data are untouched.');
  out.push('', '**Commits**', ...commits.map((c) => `- ${c[0]} ${c[1]}`));
  out.push('', '**Files by area**');
  for (const [name, rx] of AREAS) { const l = files.filter((f) => rx.test(f)); if (l.length) out.push(`- ${name} (${l.length}): ${l.join(', ')}`); }
  const rest = files.filter((f) => !AREAS.some((a) => a[1].test(f))); if (rest.length) out.push(`- Other (${rest.length}): ${rest.join(', ')}`);
  out.push('', '**Database migrations**', migrations.length ? `${migrations.join(', ')}. ${o.migrationsApplied || 'Applied to staging: NOT RECORDED. Applied to production: NOT RECORDED.'}` : 'None.');
  out.push('', `**Tests and smoke:** ${o.tests || 'NOT RECORDED'}${o.smoke ? '. ' + o.smoke : ''}`);
  out.push(`**Known gaps:** ${o.gaps || 'none recorded'}`);
  return out.join('\n');
}
module.exports = { contents };

if (require.main === module) {
  const opts = { n: arg('--n'), tests: arg('--tests'), smoke: arg('--smoke'), gaps: arg('--gaps'), migrationsApplied: arg('--migrations-applied') };
  const m = arg('--merge');
  if (m) { opts.main = g.sh(`git rev-parse --short ${m}`); console.log(contents(`${m}^1`, `${m}^2`, opts)); }
  else { g.sh('git fetch -q origin main staging'); console.log(contents('origin/main', 'origin/staging', opts)); }
}
