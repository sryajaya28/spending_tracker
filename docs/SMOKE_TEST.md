# Smoke test: Stiver (run on production right after every release)

Goal: in a few minutes, confirm the live app is not broken. It is **not** a regression test. If anything fails, fix it
immediately and release the fix (or roll back first if it affects data), then run this again. See `docs/DEV_WORKFLOW.md`.

## Accounts (never a real user)

| Where | Email | Password |
|---|---|---|
| Production (`https://stiver.io`) | `smoke.production@stiver.io` | environment secret `SMOKE_PROD_PASSWORD` |
| Staging (`https://staging.stiver.io`) | `smoke.staging@stiver.io` | environment secret `SMOKE_STAGING_PASSWORD` |

Both accounts are called "SMOKE TEST (do not delete)" and carry `smoke_test: true` in their user metadata. They have no inbox
(password reset does not work); the passwords live only in the assistant's environment secrets, never in the repository.
The test adds two records marked `SMOKE <timestamp>` and deletes them again, so the accounts stay empty.
To find them in the database: `select email from auth.users where raw_user_meta_data->>'smoke_test' = 'true';`

## Automated (about 1 minute)

```bash
SMOKE_EMAIL=smoke.production@stiver.io SMOKE_PASSWORD="$SMOKE_PROD_PASSWORD" \
  node tests/smoke/smoke.js https://stiver.io --env production
SMOKE_EMAIL=smoke.staging@stiver.io SMOKE_PASSWORD="$SMOKE_STAGING_PASSWORD" \
  node tests/smoke/smoke.js https://staging.stiver.io --env staging
```

It needs the host under Allowed domains in the assistant's environment. It checks, with nothing mocked:

1. the landing page loads;
2. the page is the expected environment (production or staging);
3. the price/FX service answers (`/api/status`, `/api/fx`);
4. sign in works;
5. the overview shows no `NaN`/`undefined`;
6. an income and an expense can be added and appear in the list;
7. both survive a reload (they reached the database);
8. Budgets, Portfolio (Savings, Debt, Investment, Lent) and Transactions open without junk values;
9. the two records can be deleted, and are gone after a reload;
10. no script errors in the console during the run;
11. sign out returns to the landing page.

Exit code 0 and the line `SMOKE PASSED` mean all steps passed. On a failure a screenshot is saved to `/tmp/smoke-fail.png`.

## Manual additions (only when the release touched these)

- **A database migration** shipped: open the screen that uses it and save once (for example a new debt type, a new column).
- **Sign-up or email:** create a real sign-up with an address you control and check the confirmation email arrives (production only, after a
  change to auth, templates or the sender).
- **Google sign-in:** one sign-in with Google (only after a change to auth settings).
- **Install / offline:** open the installed app once and check it picks up the new version (service worker cache name changed).
- **Indonesian:** switch the language to Indonesian and open the changed screens.

## Report format

```
Smoke test <date> on <url>: PASSED / FAILED
Steps: 14/14 (list any failure with the step name and message)
Manual additions run: <none | list>
Action: none | fixed in <commit> and re-run PASSED | rolled back
```
