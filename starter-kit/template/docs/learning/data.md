# Learning: Database, access rules and sync

Part of `learning.md` (index). Lessons above the line were carried over from earlier projects (starter kit); add this project's own below it, and the dated story to the Session log in `learning.md`.

- **Agent database write tools wait for an approval the owner may never see, then time out.** Never retry in the same turn. Give the owner the SQL and the SQL editor link, then verify with a read-only query. Destructive SQL (`DROP`) goes through the CI migration job or a single `begin/commit` file the owner runs.
- Reads need no approval; deletes and DDL do. Before any destructive statement: look at the rows first, delete by exact id with extra guards, and confirm identity when an email differs by a character from the expected one.
- **Applied migrations are never edited.** Add a new one. Keep numbering sequential, apply AND commit the file, document it in `context.md`. Test locally against a throwaway database before staging.
- **Upserts follow foreign keys** (parents first), deletes run in reverse. Update the sync order when a new link is added.
- Server-side defaults and triggers, not the client, set identity columns (`user_id`, `email`) on anything a user submits.
- **Every new table gets row-level security and a per-role read/write list** before it ships. A click guard is not a read-only screen: hide the controls too, and enforce in the database.
- Prefer storing a new variant inside an existing jsonb column over a new enum value when it avoids a migration, then grep every place that handles the old kinds.
- A stale edit should fail loudly with its own error code; the API layer may retry serialization failures until it times out.
- When two people (or sessions) can apply the same migration, say in the same message that it is applied, and verify through the schema, not through the migration list (a hand-run migration is not listed).
- Global rate limits that fail closed (N sign-ups an hour for everyone) block real users at scale: limit per address, with a CAPTCHA as the first control.
- Fetching every row on each open and diffing the whole data set on each save is fine for one user and wrong at scale: plan incremental sync before growth.

---
