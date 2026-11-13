/* Keeps the e2e fake honest: compares the column lists inside tests/e2e/fake_supabase.js (SCHEMA) with the real database.
 *   1. run in the Supabase SQL editor (or execute_sql) and save the JSON result to a file:
 *      select table_name, json_agg(column_name order by ordinal_position) cols from information_schema.columns
 *      where table_schema='public' group by table_name order by 1;
 *   2. node tools/check_fake_schema.js <file.json>
 * Prints every table or column that differs and exits 1 if any (a new migration adds a column: add it to SCHEMA). */
const fs = require('fs');
const m = /\/\*SCHEMA\*\/ const SCHEMA = (\{.*?\}); \/\*END SCHEMA\*\//s.exec(fs.readFileSync(__dirname + '/../tests/e2e/fake_supabase.js', 'utf8'));
if (!m) { console.log('SCHEMA block not found in tests/e2e/fake_supabase.js'); process.exit(2); }
const fake = JSON.parse(m[1]);
const file = process.argv[2]; if (!file) { console.log('usage: node tools/check_fake_schema.js <db-columns.json>'); process.exit(2); }
let raw = JSON.parse(fs.readFileSync(file, 'utf8')); if (raw.result) raw = JSON.parse(/\[[\s\S]*\]/.exec(raw.result)[0]);
const db = Object.fromEntries(raw.map((r) => [r.table_name, r.cols]));
let bad = 0;
for (const [t, cols] of Object.entries(fake)) {
  if (!db[t]) { console.log(`table ${t}: in the fake, not in the database`); bad++; continue; }
  for (const c of cols) if (!db[t].includes(c)) { console.log(`${t}.${c}: in the fake, not in the database`); bad++; }
  for (const c of db[t]) if (!cols.includes(c)) { console.log(`${t}.${c}: in the database, missing from the fake`); bad++; }
}
console.log(bad ? `${bad} difference(s)` : 'fake schema matches the database');
process.exit(bad ? 1 : 0);
