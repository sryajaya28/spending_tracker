# Stack pack: Supabase + Vercel + browser tests (reference implementations from the first project)

Installed with `install.sh --stack`. These files worked in production for the first project (a static web app, Supabase with row-level security and Edge Functions, Vercel, Playwright). The scripts marked "ready" run from `tools/kit.config.json`; the ones marked "adapt" carry the first project's screens, tables or function names and must be edited (or deleted) before use. `BOOTSTRAP.md` step 5 walks through this table.

| File | What it does | State |
|---|---|---|
| `tools/ship.js` (+ `ship.test.js`), `tools/release_contents.js` | after "Release": wait for the production build stamp, check the site, run the smoke test when the tier needs it, write the release record | ready (needs a build stamp in `sw.js`, see `stamp_sw.js`) |
| `tools/stamp_sw.js`, `vercel.json` | stamps the service-worker cache name with the commit at build time (no hand-bumped version, no merge conflicts); security headers and CSP | adapt `vercel.json` (hosts in the CSP, rewrites) |
| `tools/regression.js`, `tests/staging/regression.js` | regression on the exact staging commit, against the real staging database with the smoke account | adapt (flows) |
| `tests/smoke/smoke.js` | production smoke test with a dedicated account: sign in, create, reload, delete, no console errors | adapt (steps) |
| `tools/staging_shot.js` | phone-width and dark-mode screenshots of staging for the ready report | ready |
| `tools/migrate.js`, `tools/db_url_check.js`, `.github/workflows/deploy.yml` | CI applies migrations (staging on push, production behind an approval click) and deploys Edge Functions; no agent pastes SQL | adapt `deploy.yml` (function names) |
| `tools/sql_local_test.sh` | runs migrations and SQL tests on a throwaway local PostgreSQL with stubbed Supabase roles | adapt (test file names; needs `supabase/tests/local/stubs.sql`) |
| `tests/e2e/run_all.sh`, `tools/affected_tests.js` | parallel browser suite with one PASS/FAIL line per test; picks the tests a diff needs from `tests/e2e/affects.json` | ready once tests are listed; adapt the path lists in `affected_tests.js` |
| `tests/e2e/fake_supabase.js`, `tools/check_fake_schema.js` | in-memory stand-in for Supabase that rejects unknown tables and columns, and a check of its schema against the real database | adapt (SCHEMA block) |
| `docs/FIGMA.md`, `tools/figma/` | Figma library rules, helper and lint scripts for design-first work | adapt (component names) |
| `docs/ANALYTICS_POSTHOG.md` | the full PostHog tracking guide (proxy rewrite, bot filter, catalog) | merge into `docs/ANALYTICS.md` |
