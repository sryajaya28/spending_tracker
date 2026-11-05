# QA fixes: Viewer write controls, manual_prices id (staging 863473b)
- A Viewer no longer sees any button that starts a change (raised Add hidden but its slot kept, "+ Budget", "+ Account", "Edit", "+ Add", Transfer, Invest ...) on any screen; rows that open a read-only detail stay. PRD check 17.
- A Viewer's app never writes, not even on load (`Cloud.save` returns for a Viewer or someone without access).
- `manual_prices` rows no longer carry an `id` (the table's key is user_id, symbol, price_date; there is no id column), and the save diff now uses the household owner id like the load snapshot did, so a member's manual prices are not re-sent on every save.
- Likely also a bug for solo owners on main: any change to a hand-typed asset price sent `id` and PostgREST refuses unknown columns. Staging table columns checked (no id); production not touched.
- Tests: `household_labels` (Viewer controls on 5 screens, no write on load, manual-price save); fake Supabase now rejects an `id` on manual_prices like the real table. New tests fail on the old code (checked).
