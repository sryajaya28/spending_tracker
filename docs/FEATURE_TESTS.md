# Feature tests

One entry per feature. The owner can add entries at any time ("also test X"); the assistant adds the steps, runs them and
records the result. A feature is **ready for review** only when its entry passes (see `docs/DEV_WORKFLOW.md`).
Regression testing on staging runs only when the owner asks for it.

Every entry must also check the feature's **event tracking** (new buttons have a `data-act`, new outcomes fire a named event, nothing private is sent): see `docs/ANALYTICS.md` and `tests/e2e/analytics.js`.

How to fill an entry:

| Field | Meaning |
|---|---|
| ID | `FT-<number>`, never reused |
| Feature | one line, in the owner's words |
| Steps | what to do, in order |
| Expected | what must happen |
| Covered by | automated test file (`tests/e2e/<name>.js`) or `manual` (and where it was checked: local / preview / staging / device) |
| Status | `todo`, `pass (date, where)`, `fail (date, note)` |

## Open (to test before the next release)

| ID | Feature | Steps | Expected | Covered by | Status |
|---|---|---|---|---|---|
| FT-001 | Branch previews use the staging database and show the "Staging · test data" label | Open the preview link of a branch; sign up with a made-up email | Label visible; account exists in the staging database only; stiver.io shows no label and uses production | smoke test + manual (preview) | pass on staging (2026-11-03); branch-preview link not opened by the assistant (host not allowed) |
| FT-002 | Phone number pad on amount boxes | On an iPhone open Add transaction, Add debt, Sell | Number pad (not the full keyboard) opens for amount, fee, quantity, price | manual (device) | todo |
| FT-003 | Debt types Bank Loan and Paylater save and sync | Add a debt of each type, reload | Both stay, with the right label | `tests/staging/regression.js` | pass (2026-11-03, staging, real database) |
| FT-004 | Landing-page demo video shows the latest build (Debt tab, Realized P&L) | Sign out, open the landing page, play the video; check the caption in English and Indonesian | Video plays on phone and desktop, shows the Debt tab and Realized P&L; caption matches | `tests/e2e/idcrawl.js` (caption text) + manual (play on a phone) | frames checked by the assistant, caption served on staging (2026-11-04); not played on a real phone |
| FT-005 | Deposit/Withdraw on an investment Cash balance are transfers: amount only, optional fee, editable, deletable; Transfer lists Cash balances as From/To | Open a Cash balance, Deposit 5,000,000 with fee 2,500, edit it, withdraw 1,000,000 with fee 1,500, delete one | Balances follow; rows read "Transfer to/from <account> (Cash)"; old cash rows show as transfers | `tests/e2e/cashxfer.js`, `tests/staging/regression.js` + manual on a phone | pass locally and on staging with the real database (2026-11-04); not tried on a real phone |
| FT-006 | Sign-up needs the Privacy Policy / Terms tick box (Google and e-mail); show/hide password on every password box | Open Create account, try both buttons unticked, tick, untick; use the eye on sign-in, sign-up and reset | Buttons disabled until ticked; links open the pages; the eye toggles and keeps the text | `tests/e2e/consent.js`, `analytics.js` + manual on a phone | design approved by the owner 2026-11-04 (button only when something is archived); pass locally; waiting for the owner's review of the preview link |
| FT-007 | Archived categories can be seen and restored (button left of + Category, shown only while something is archived) | Archive a category, open Archived, Restore it; archive a sub-category alone and restore it | Parent returns with its sub-categories; a lone sub-category returns alone; empty state when none | `tests/e2e/archcat.js`, `analytics.js` + manual on a phone | pass locally (2026-11-04); waiting for the owner's review of the preview link |
| FT-011 | Money lent comes out of an account: required From account, linked transfer out with category Lent, edit/delete in step, repayments unchanged (PRD `docs/prd/2026-11-06-lent-from-account.md`, 10 checks) | Follow `regression_scenario.md` section 18 (LF-01..LF-16) on staging with the smoke account, reading balances and net worth before and after; Indonesian, dark, 390 px | Every PRD check 1-10 verified (how) or not checked (why); net worth unchanged on lending; balance restored on delete; Editor can edit an owner-created lent record end to end | `tests/e2e/lent*.js` (planned), `tests/staging/lent.js` (planned) + manual | todo (test cases written 2026-11-06, build not started) |
| FT-008 | Household access: an owner invites family by email as Editor or Viewer; invitee joins from the email, creates a password, lands in the household; every record shows who made it; Editors change only their own transactions | The 38 Given/When/Then checks of `docs/prd/household.md` (invite, email link, join, roles, who-did-it labels, freshness, safety, delete guard) in slices: slice 1 checks 1-31 and 33-38, slice 2 check 32 (Activity) | Each check passes as written; Viewer and Editor limits are enforced by the database as well as the screens; a solo owner sees no change at all | SQL: `supabase/tests/household_*.test.sql`; e2e: `tests/e2e/household*.js`; real staging: `tests/staging/household.js` (two smoke accounts, one real invite to a `+alias` inbox) | slice 1 built on feature/household (migrations 24-30 on staging, e2e + local SQL pass 2026-11-05); slice 2 Activity built (migration 31 written, tested locally, staging apply pending); review by Tech-Lead pending |
| FT-012 | Hide balance: an eye button on Overview (Spent today) and Portfolio (Net worth) masks the two hero amounts and every Portfolio balance; remembered on the device; the change pill is red or green | On Overview tap the eye: today's total and the "left this month" amount turn to dots, the bar, the days and Recent transactions stay. Open Portfolio: Net worth, Breakdown amounts, each tab's total and each account / debt / lent / holding balance are dots, the % shares stay. Tap the eye there: both screens show again. Hide, close the app, reopen. On Portfolio the Net worth pill is red when the month fell, green when it grew. "Spent today" is plain text (no underline, no tooltip) | Everything hidden together, transactions never hidden, still hidden after reopening, pill red when the month fell and green when it grew, light and dark, 390 px wide | `tests/e2e/hidebal.js` (local); device check manual | pass (2026-11-11, local) |

## Done (kept for reference)

| ID | Feature | Covered by | Status |
|---|---|---|---|
| FT-101 | Realized P&L section, month page with period dropdown and All time | `tests/e2e/invest.js` | pass (2026-11-02, local) |
| FT-102 | Sale into the investment account's cash records its profit or loss, fee on top | `tests/e2e/invest.js`, `fees.js`, `avgprice.js` | pass (2026-11-02, local) |
| FT-103 | Debt form: installments remaining, interest, flat or declining | `tests/e2e/debtcalc.js` | pass (2026-11-03, local) |
| FT-104 | Loan renamed Debt; Vehicle loan; tab order Savings, Debt, Investment, Lent | `tests/e2e/loanpay.js`, `repay.js`, `onboarding.js` | pass (2026-11-03, local) |
| FT-105 | Smoke test passes on staging and production | `tests/smoke/smoke.js` | pass (2026-11-03, staging and production) |
| FT-106 | Overview hero "Spent today": today's expenses, the budget line and bar, Balance chip, currency selector; the Budgets card is gone | Add an expense today, an income today, a transfer and an expense dated tomorrow: the big number is only today's expense. Set a monthly budget: "Rp x left this month · n days to go" and a thin bar; tap them: Budgets opens. Spend past the budget: "over budget", red bar. Tap Balance ›: Portfolio opens. Change the currency next to the number: both amounts convert. Tap the eye: both amounts are dots, bar and days stay | Only today's expenses counted, last period day says "1 day to go", no budget shows "Set a monthly budget ›" and no bar, no Budgets card on Overview, light and dark, 390 px wide | `tests/e2e/spenthero.js`, `budgetbar.js`, `hidebal.js`, `analytics.js` (local); staging check by the owner | pending |
