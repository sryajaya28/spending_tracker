# Learning: Database, Supabase, RLS and sync

Part of `learning.md` (index). Add a line here when a mistake in this area happens; add the dated story to the Session log in `learning.md`.

- **Supabase write tools (`apply_migration`, `execute_sql` for writes) wait for the owner's approval and time out after ~230 s**
  when nobody answers. Never retry in the same turn. Give the owner the SQL and the SQL Editor URL
  (`https://supabase.com/dashboard/project/ukoxkwxmkwtlihbutryc/sql/new`), then verify with a read-only query afterwards.
- Reads (`select`) work without approval; deletes and DDL do not. Before any destructive statement: look at the rows first,
  delete by exact id with extra guards (`user_id`, `note`), and confirm identity when an email differs from the signed-in
  user's (the owner once mistyped their own address by one character; check close variants with `ilike` before acting).
- **Upsert order must follow foreign keys.** `debts` before `transactions` (an expense can point at a loan) and `debt_payments`
  after `transactions` (a charge points at its expense). Deletes run in reverse. Update `STAGES` in `cloud.js` when adding links.
- Server-side defaults and triggers, not the client, must set identity columns (`user_id`, `email`) for anything the user submits.
- Apply a migration file AND commit it (`supabase/migrations/…`), keep numbering sequential, document it in `context.md` §6.
- `recurring_rules.kind` has a check constraint (txn/transfer/invest). Store a new variant inside the existing kind's `spec` jsonb (`spec.debt`) to avoid a migration, then teach every place that handles `txn` rules (grep `r.kind === 'txn'` and `sp.wallet_id`).

