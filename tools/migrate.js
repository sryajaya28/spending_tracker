/* Applies the repo's supabase/migrations to a database through psql, one file at a time, each in ONE transaction together with its row in
 * public._repo_migrations (so a failed migration changes nothing). No agent tool, no confirmation prompt: this is what CI runs.
 *
 *   DB_URL=postgresql://... node tools/migrate.js [--dry-run] [--baseline-through <version>]
 *
 * First run on a database that already has the schema (staging and production were migrated by hand, outside this tracker):
 *   --baseline-through 20261105000031   marks every migration up to and including that version as applied, WITHOUT running it.
 * After that, only newer files run. Files are applied in filename order. --dry-run prints the plan and runs nothing that changes data. */
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const dir = process.env.MIGRATIONS_DIR || path.join(__dirname, '..', 'supabase', 'migrations');
const args = process.argv.slice(2), dry = args.includes('--dry-run');
const bi = args.indexOf('--baseline-through'), baseline = bi >= 0 ? args[bi + 1] : null;
const url = process.env.DB_URL;
if (!url) { console.log('DB_URL is not set'); process.exit(2); }
const psql = (a, input) => spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', ...a], { encoding: 'utf8', input });
const run = (a, input) => { const r = psql(a, input); if (r.status !== 0) { console.log((r.stderr || r.stdout || 'psql failed').trim()); process.exit(1); } return (r.stdout || '').trim(); };
const files = fs.readdirSync(dir).filter((f) => /^\d{14}_.*\.sql$/.test(f)).sort(), ver = (f) => f.split('_')[0];
let have = run(['-c', "select to_regclass('public._repo_migrations') is not null"]) === 't';
if (!have) {
  if (!baseline) { console.log('public._repo_migrations does not exist: run once with --baseline-through <version> (the last migration already applied by hand).'); process.exit(1); }
  if (dry) console.log('[dry-run] would create public._repo_migrations'); else run(['-c', 'create table public._repo_migrations (version text primary key, name text not null, applied_at timestamptz not null default now()); alter table public._repo_migrations enable row level security; revoke all on public._repo_migrations from anon, authenticated;']);
}
const done = new Set(have || !dry ? run(['-c', 'select version from public._repo_migrations']).split('\n').filter(Boolean) : []);
let n = 0;
for (const f of files) {
  const v = ver(f); if (done.has(v)) continue;
  if (baseline && v <= baseline) { console.log(`baseline  ${f}`); if (!dry) run(['-c', `insert into public._repo_migrations(version, name) values ('${v}', '${f.replace(/'/g, "''")}')`]); continue; }
  console.log(`${dry ? 'would apply' : 'applying'}  ${f}`); n++;
  if (!dry) run(['-1', '-f', path.join(dir, f), '-c', `insert into public._repo_migrations(version, name) values ('${v}', '${f.replace(/'/g, "''")}')`]);
}
console.log(n ? `${dry ? 'would apply' : 'applied'} ${n} migration(s)` : 'nothing to apply');
