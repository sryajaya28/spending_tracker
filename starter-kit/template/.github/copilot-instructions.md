# Review guidance for __PROJECT__ (read by GitHub Copilot code review; keep under 4,000 characters)

<One sentence: what the product is and its stack.> Review the diff, not the whole repo. Say nothing when you have nothing to flag; do not praise or restate the diff.

## Flag, in this order
1. **Secrets and keys.** Any secret credential (password, service key, database URL, access token, private key) in code, tests, docs or config. Docs say where secrets live, never what they are. Not a finding: publishable browser keys that `context.md` says are committed on purpose.
2. **Money and totals.** Rounding, sign errors, wrong currency or date handling, anything that could change the value of an existing record.
3. **Who sees and does what.** Flag a write control, request or access policy a read-only or former member could reach, including UI that is hidden but still callable.
4. **Database changes.** Applied migrations are never edited, only added to. New tables have row-level security; policies match the roles; columns the code reads or writes exist.
5. **Auth and sync.** Unchecked input, missing auth checks, errors that leak data.
6. **Security headers and config.**
7. **Tests.** A behaviour change without a test that fails on the old code. A test that is skipped, loosened or quarantined to get green.
8. **Event tracking.** A new button, form or outcome without tracking, a test assertion and an entry in `docs/ANALYTICS.md`.
9. **Keep-current docs.** A feature change should update `context.md`, `regression_scenario.md`, `docs/FEATURE_TESTS.md` and add a `docs/changes/YYYY-MM-DD-name.md` file. `docs/CHANGELOG.md` is never edited directly.

## Do not flag
- Style, naming or formatting that CI does not enforce.
- Anything under `docs/archive/` or `docs/learning-archive.md`.

## Format
One short comment per finding: what is wrong, the file and line, and the concrete failure (input or state, then wrong result). Mark each as **blocker** (money, access, secrets, data loss) or **minor**.
