# Money lent comes out of an account (owner 2026-11-06, Tier 3)
- Add money lent has a required "From account" (savings accounts, no cards; last used preselected; currency follows the account; no future date). Saving makes one transfer out with category Lent, so the balance drops and Transactions shows it; net worth is unchanged and it is not spending.
- Not enough balance: the loan-payment message, Save off. Editing a lent record keeps its transaction in step; older records (no account) are unchanged and editable. A household Editor can change only the due date and note of someone else's lent record.
- Transactions: lent row = "Transfer out" + Lent chip, read-only detail "Managed from Money lent"; repayment rows now show "Transfer in", the Lent Repayment chip and a green +amount (Figma 84:702). Sample data lends from the first bank account. Indonesian strings.
- Migration 32 `debts.lent_transaction_id` (additive, no FK); the e2e fake schema knows it. Analytics: `add_lent` / `update_lent` carry `has_account`.
- Tests: `lent` (new), `repay` (row format), SQL `household_lent` (4). No delete action exists for lent records (Archive only): the PRD's delete rule has nothing to attach to yet.
- RELEASE ORDER: apply migration 32 to the database first, then ship the client (the client now sends `lent_transaction_id`).
