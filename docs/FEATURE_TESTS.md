# Feature tests

One entry per feature. The owner can add entries at any time ("also test X"); the assistant adds the steps, runs them and
records the result. A feature is **ready for review** only when its entry passes (see `docs/DEV_WORKFLOW.md`).
Regression testing on staging runs only when the owner asks for it.

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
| FT-001 | Branch previews use the staging database and show the "Staging · test data" label | Open the preview link of a branch; sign up with a made-up email | Label visible; account exists in the staging database only; stiver.io shows no label and uses production | manual (preview) | todo |
| FT-002 | Phone number pad on amount boxes | On an iPhone open Add transaction, Add debt, Sell | Number pad (not the full keyboard) opens for amount, fee, quantity, price | manual (device) | todo |
| FT-003 | Debt types Bank Loan and Paylater save and sync | Add a debt of each type, reload | Both stay, with the right label | manual (staging; needs the enum migration) | todo |

## Done (kept for reference)

| ID | Feature | Covered by | Status |
|---|---|---|---|
| FT-101 | Realized P&L section, month page with period dropdown and All time | `tests/e2e/invest.js` | pass (2026-11-02, local) |
| FT-102 | Sale into the investment account's cash records its profit or loss, fee on top | `tests/e2e/invest.js`, `fees.js`, `avgprice.js` | pass (2026-11-02, local) |
| FT-103 | Debt form: installments remaining, interest, flat or declining | `tests/e2e/debtcalc.js` | pass (2026-11-03, local) |
| FT-104 | Loan renamed Debt; Vehicle loan; tab order Savings, Debt, Investment, Lent | `tests/e2e/loanpay.js`, `repay.js`, `onboarding.js` | pass (2026-11-03, local) |
| FT-105 | Smoke test passes on staging and production | `tests/smoke/smoke.js` | pass (2026-11-03, staging and production) |
