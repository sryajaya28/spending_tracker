# QA report: household access on staging 863473b (real accounts), 2026-11-05

Stopped at the first failure, as the Tech-Lead asked. Staging only. Owner = smoke.staging (SMOKE TEST); member = a real invite to `suryajaya378+hh3@gmail.com` (1 email, 5 in total with the earlier 4).

## Bugs (2)
**1. BLOCKING (PRD check 17, UI part): a Viewer sees write controls on every screen.**
- Steps: join as Viewer (owner sets role viewer) -> sign in -> open Overview, Transactions, Budgets, Portfolio.
- Expected: no Add, Edit or Delete control anywhere (check 17).
- Actual (probe, 390 px): the raised "Add transaction" button in the bottom bar on all four screens; Budgets also shows "+ Budget", "Edit" and two "+ Add"; Portfolio shows "+ Account". Tapping the raised Add opens nothing and says nothing (dead control). Screenshot: `docs/reviews/img/qa-viewer-budgets-390.png`.
- The data is safe: the database refused 12/12 direct inserts by the Viewer (below). Only the UI contradicts the check.

**2. MAJOR: any member's app fails on every load once the household has a manual price (error toast, repeated write calls).**
- Steps: owner household has one `manual_prices` row (I inserted `QAHH...`, price 1) -> member signs in.
- Actual: toast "Couldn't save your last change (Could not find the 'id' column of 'manual_prices' in the schema cache). Showing your saved data." The app sent `POST manual_prices?on_conflict=user_id,symbol,price_date&columns=id,user_id,symbol,price_date,price_usd` -> 400 three times in 12 s while the user did nothing. The table has no `id` column (key is user_id, symbol, price_date, migration 5). A Viewer should also never attempt a write at load (the database would refuse it anyway).
- Gone after I deleted my manual price. The same row-mapping code (`id: key`) exists on `main` (cloud.js line 71), so owners with manual prices may be affected today: NOT tested on production; the Full-stack engineer should confirm.

## Verified on staging 863473b (evidence: scripts in tests/staging/household/, run output)
| Check | Result |
|---|---|
| HH-09 link not consumed by a scanner | PASS: 3 plain GETs of /join return 200; opening the page in a browser (light and dark) makes only one `preview` call; the link still previews (role editor) afterwards; consumed only by the form submit; used link then shows the dead-link page with no form |
| HH-11 join page | PASS: names owner and role; button off until name + 8-char password + tick |
| HH-12 join and data | PASS: signed in after submit; member reads the owner's wallet and all 77 categories (all rows belong to the owner), listed in household_people. (My first UI assertion about an empty ledger was a test error: the owner's ledger was empty.) |
| HH-18 Editor insert on all 12 tables | PASS 12/12 (201), `created_by` = Editor set by the database; a spoofed `created_by` is overwritten |
| HH-39 Editor vs owner's transaction | PASS: edit, delete, upsert-over, move to another account, claim `created_by` all change 0 rows or are refused (403 RLS); owner's row unchanged (query) |
| HH-37 / HH-40 | PASS: Editor edits own (updated_by = Editor); owner edits and deletes the Editor's (updated_by = owner) |
| HH-44 / HH-45 | PASS: Editor deleting an account or category that holds the owner's transaction is refused (403 `household_guard:wallet:1` / `household_guard:category:1`), nothing deleted (query); deleting their own empty ones works; Editor may still edit the owner's account |
| HH-17 Viewer, database | PASS: insert refused on 12/12 tables; update and delete change 0 rows on 5 tables; reads still work |
| HH-30 non-owner | PASS: Viewer invite 403; promote self 403 "only the owner can change roles"; remove owner 403; direct write to household_members 403; membership unchanged |
| Policy completeness | PASS: all public tables have RLS; the 12 money tables have select/insert/update/delete policies on household_owner() with a write guard; household and internal tables have select-only or no policies; anon has no table grants on them; join/resend helper functions are not executable by anon or signed-in users |
| Contact address | PASS (earlier): support@stiver.io on Privacy and Terms |

## NOT run (stopped at the first failure)
Live-app role change and removal (HH-19 notice within 30 s, HH-20 no-access page, HH-35 Delete my login, HH-38 "read-only" marker in the browser), dark/390 px proof beyond the join page (`docs/reviews/img/qa-join-dark-390.png`), HH-31 spoofed sign-up, HH-05 cap, rate limit (11th invite), revoke/expiry link (needs 1 email), HH-36 re-invite (needs 1 email), resend, Indonesian text and email, invite-sweep with the service key.
From reading the code only (not seen in the UI): the no-access page says "this household" not "<owner>'s household" (PRD 20), and `delete-my-login` has no confirmation step (HH-35 expected one).

## Process note
I read the PM's "Mailinator addresses only, no more Gmail +aliases" instruction after I had already sent my one invite to `suryajaya378+hh3@gmail.com` (so Gmail +alias emails are 5 of the owner's approved ~6, not 4). No further Gmail invites were sent; any remaining test (revoke link, re-invite) will use Mailinator.

## State left on staging
Owner data back to baseline (0 transactions, 1 wallet, 77 categories, 0 of every other test table; verified). One login of mine remains, a Viewer member (`+hh3`, name "QA Editor"), kept so the Viewer fix can be retested without another email. No pending invites. The earlier mailinator logins were not touched.

Owner-bound asks: all on the Workspace (yes/no): no, via the PM.
