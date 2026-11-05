/* Prints the SHAPE of the DB_URL secret without printing the password: scheme, user, host, port, database and facts about the password
 * (length, brackets, whitespace, quotes, characters that must be URL-encoded). Used by the deploy workflow to debug login failures. */
const raw = process.env.DB_URL || '';
const out = (k, v) => console.log(`${k}: ${v}`);
out('secret present', raw ? 'yes' : 'NO (empty: the secret does not exist or the environment cannot read it)');
out('length', raw.length);
out('leading/trailing whitespace or newline', raw !== raw.trim() ? 'YES (remove it)' : 'no');
out('contains quotes', /["']/.test(raw) ? 'YES (remove them)' : 'no');
const m = /^(\w+):\/\/([^:/@]*):(.*)@([^@/:]+):(\d+)\/(.*)$/s.exec(raw.trim());
if (!m) { out('parse', 'FAILED: expected postgresql://USER:PASSWORD@HOST:PORT/DATABASE (a raw @ or / inside the password breaks this)'); process.exit(0); }
const [, scheme, user, pw, host, port, db] = m;
out('scheme', scheme); out('user', user); out('host', host); out('port', port); out('database', db);
out('password length', pw.length);
out('password has [ or ]', /[\[\]]/.test(pw) ? 'YES (brackets were left in)' : 'no');
out('password equals the placeholder', /YOUR-PASSWORD/i.test(pw) ? 'YES (not replaced)' : 'no');
out('password has characters needing URL-encoding', /[^A-Za-z0-9._~-]/.test(pw) ? 'YES (use a letters-and-numbers password)' : 'no');
