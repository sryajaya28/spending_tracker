# Task: Lent from account (2026-11-11)
**Request (owner's words):** "Read docs/workflows/COST_PLAN.md and do item D1 D2 D3" (D1 task 1 = finish Lent from account, Tier 3, open review bug first); owner confirmed "go".
**Tier:** 3 (migration, financial calculation; floor from `node tools/path_tier.js`).
**Done when:**
- [x] Review bug fixed (lent categories found by id first): `lent` e2e step 8b.
- [x] Ported from the old app.js onto the split files; full e2e 58/58, SQL tests ok (household_lent 4/4).
- [x] Migration 32 applied to staging DB and verified (column exists, nullable uuid); NOT production.
- [ ] Owner checks staging (Money lent: add from account, edit, Transactions row, dark mode, phone width), then says "Release".
- [ ] Fresh diff-only review session (Opus 5.5 or Fable 5.2), Tier 3 step 4.
**Files:** `prototype/app/{charts,events-submit,events-input,views,loans-calc,categories,seed}.js`, `prototype/cloud.js`, `prototype/i18n-id.js`, migration 32, `tests/e2e/lent.js`, `supabase/tests/household_lent.test.sql`.
**Branch / PR:** `claude/lent-from-account` / see PR to `staging`.
**Open / next:** release order: migration 32 to production first, then the client. D1 tasks 2 to 5 (owner picks), then D2, D3.
