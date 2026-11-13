/* node tools/path_tier.test.js : the default tier rules. Add a line here whenever a rule in kit.config.json changes. */
const { classify } = require('./path_tier.js'), assert = require('assert'), A = require('./kit.config.json').appDir;
const t = (files, want) => assert.strictEqual(classify(files).tier, want, JSON.stringify(files));
t(['docs/x.md', 'README.md', 'tools/a.js', '.gitignore', '.env.example'], 1);
t([`${A}/styles.css`, `${A}/brand/logo.png`, `${A}/i18n-id.js`, `${A}/locales/id.json`], 1);
t([`${A}/main.js`], 2); t([`${A}/styles.css`, `${A}/views/list.js`], 2); t(['tests/e2e/x.js'], 2); t(['.github/workflows/ci.yml'], 2); t(['package.json'], 2);
t(['some/new/place.txt'], 2);
t([`${A}/cloud.js`], 3); t([`${A}/lib/auth-client.ts`], 3); t(['supabase/migrations/001_x.sql'], 3); t(['supabase/functions/join/index.ts'], 3); t(['api/index.py'], 3);
t(['vercel.json'], 3); t([`${A}/config.js`], 3); t(['.env.local'], 3); t(['x/y/seed.sql'], 3);
t(['supabase/functions/DEPLOY.md'], 1); t(['docs/x.md', `${A}/cloud.js`], 3);
console.log('ok path_tier');
