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
| FT-006 | Sign-up needs the Privacy Policy / Terms tick box (Google and e-mail); show/hide password on every password box | Open Create account, try both buttons unticked, tick, untick; use the eye on sign-in, sign-up and reset | Buttons disabled until ticked; links open the pages; the eye toggles and keeps the text | `tests/e2e/consent.js`, `analytics.js` + manual on a phone | pass locally (2026-11-04); waiting for the owner's review of the preview link |

## Done (kept for reference)

| ID | Feature | Covered by | Status |
|---|---|---|---|
| FT-101 | Realized P&L section, month page with period dropdown and All time | `tests/e2e/invest.js` | pass (2026-11-02, local) |
| FT-102 | Sale into the investment account's cash records its profit or loss, fee on top | `tests/e2e/invest.js`, `fees.js`, `avgprice.js` | pass (2026-11-02, local) |
| FT-103 | Debt form: installments remaining, interest, flat or declining | `tests/e2e/debtcalc.js` | pass (2026-11-03, local) |
| FT-104 | Loan renamed Debt; Vehicle loan; tab order Savings, Debt, Investment, Lent | `tests/e2e/loanpay.js`, `repay.js`, `onboarding.js` | pass (2026-11-03, local) |
| FT-105 | Smoke test passes on staging and production | `tests/smoke/smoke.js` | pass (2026-11-03, staging and production) |
