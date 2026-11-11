# Review guidance for Stiver (read by GitHub Copilot code review; keep under 4,000 characters)

Stiver is a personal and household spending tracker: a static web app (`prototype/`), Supabase (Postgres with row-level security, Edge Functions in `supabase/`) and a Vercel deploy. Review the diff, not the whole repo. Say nothing when you have nothing to flag; do not praise or restate the diff.

## Flag, in this order
1. **Secrets and keys.** Any secret credential (password, service-role key, DB URL, access token, private key) in code, tests, docs or config. Docs say where secrets live, never what they are. Not a finding: the public browser values committed on purpose in `prototype/config.js` (Supabase URL and publishable anon key, PostHog project token, Turnstile site key).
2. **Money correctness.** Net worth, balances, currency conversion, recurring entries, imports. Look for rounding, sign errors, wrong currency or date handling, and anything that could change the value of an existing record.
3. **Who sees and does what.** Owner, Editor, Viewer and former member. Flag a write control, request or RLS policy a Viewer or former member could reach, including UI that is hidden but still callable.
4. **Database changes.** Applied migrations in `supabase/migrations/` must never be edited, only added to. Check new tables have RLS, policies match the roles above, and columns the code reads or writes exist.
5. **Auth and sync.** Changes to `prototype/cloud.js`, sign-in, invites, `api/` and Edge Functions: unchecked input, missing auth checks, errors that leak data.
6. **Security headers and config.** `vercel.json`, `prototype/config.js`.
7. **Tests.** A behaviour change without a test that fails on the old code. A test that is skipped, loosened or quarantined to get green.
8. **Event tracking.** A new button, form or outcome needs `data-act` or `data-form`, an `Analytics.track` call, an assertion in `tests/e2e/analytics.js` and an entry in `docs/ANALYTICS.md`.
9. **Keep-current docs.** A feature change should update `context.md`, `regression_scenario.md`, `docs/FEATURE_TESTS.md` and add a `docs/changes/YYYY-MM-DD-name.md` file. `docs/CHANGELOG.md` is never edited directly.

## Do not flag
- Style, naming or formatting that CI does not enforce.
- Anything under `docs/archive/` or `docs/learning-archive.md`.
- The size of `prototype/app.js` (it is being split in a separate plan).

## Format
One short comment per finding: what is wrong, the file and line, and the concrete failure (input or state, then wrong result). Mark each as **blocker** (money, access, secrets, data loss) or **minor**.
