const { classify } = require('../tools/path_tier.js'); const assert = require('assert');
const t = (files, want) => assert.strictEqual(classify(files).tier, want, JSON.stringify(files));
t(['docs/x.md', 'README.md', 'tools/a.js'], 1);
t(['prototype/styles.css', 'prototype/i18n-id.js', 'prototype/brand/logo.png'], 1);
t(['prototype/app.js'], 2); t(['prototype/app/util.js'], 2); t(['prototype/styles.css', 'prototype/app.js'], 2); t(['tests/e2e/x.js'], 2); t(['.github/workflows/ci.yml'], 2);
t(['prototype/cloud.js'], 3); t(['supabase/migrations/20261105000032_x.sql'], 3); t(['supabase/functions/join-household/index.ts'], 3);
t(['supabase/functions/DEPLOY.md'], 1); t(['supabase/functions/DEPLOY.md', 'supabase/migrations/20261105000032_x.sql'], 3);
t(['vercel.json'], 3); t(['prototype/config.js', 'docs/a.md'], 3); t(['something/unknown.bin'], 2);
console.log('ok path_tier');
