# Technical design: household access (for Developer 2's review)

PRD: `docs/prd/household.md` (v2, PM-approved 8b7b0c5). Design v3 answers Developer 2's review (8 blocking B1-B8, 6 suggestions S1-S6); section 12 maps each finding to where it is fixed.

## 1. Approach
Keep `user_id` = the **household owner's id** on every money row. A member writes rows with `user_id = owner id`, so no existing FK, composite FK `(id,user_id)`, unique index or constraint changes, and the owner's path is identical to today. Not chosen: a new `household_id` on every table (huge migration).

## 2. Schema (all new tables: RLS on, anon revoked)
- `household_members(owner_id, member_id unique, role check in ('editor','viewer'), added_at, pk(owner_id, member_id))`. One household per person; an owner cannot be a member (function check).
- `household_former_members(owner_id, member_id, display_name, removed_at)`: written when someone leaves or is removed, so their name stays on past entries (PRD check 26).
- `household_invites(id uuid pk, owner_id, email text (stored lower-cased), role, invited_by, created_at, expires_at, status check in ('pending','accepted','revoked','expired'))` + partial unique `(owner_id, email) where status='pending'`.
- `invite_attempts(owner_id, email_hash, at)`: one row per **attempt**, success or failure (rate limit, B4).
- `household_state(owner_id pk, rev bigint)`: bumped on any change to the household's data or membership (polling, B2c).
- Slice 2: `activity_log(id bigint identity, owner_id, actor_id, actor_name text, entity, entity_id, action check in ('create','update','delete'), summary jsonb, at)` + index `(owner_id, at desc)`, 180-day purge job.
- New columns on `wallets, transactions, categories, budgets, investment_accounts, holdings, holding_events, debts, debt_payments, occasions, recurring_rules`: `created_by uuid`, `updated_by uuid`, `rev int not null default 1`. Every `user_id ... default auth.uid()` becomes `default household_owner()` so an insert that omits `user_id` lands on the owner (B1).
- Personal tables stay personal: `profiles`, `auth_handoffs`, `support_reports`, storage `support-attachments`.

## 3. Functions (S1: all security definer, `set search_path = ''`, fully qualified, `revoke execute from public, anon`, grant only to `authenticated`; email handling uses `lower(email)` text, no citext)
`household_owner()` (caller's owner id; self if owner), `is_writer()` (owner or editor), `household_profile()` (returns only whitelisted columns of the owner's profile: currency, period_day, sample flag, language default; `profiles` itself stays self-only, B6), `accept_household_invite()`, `my_pending_invite()`, owner-only RPCs `set_member_role`, `remove_member`, `revoke_invite`, member RPC `leave_household`.

## 4. RLS (B1)
On **every** public table that has a `user_id`: select `using (user_id = (select household_owner()))`; insert/update/delete add `and (select is_writer())` (`with check` the same). Wrapped as initplans: evaluated once per query, no per-row function calls; the owner path equals today's. Migration 2 replaces **all** policies, found by looping `pg_policies` (not only the five in `0002`): `recurring_rules` (4 separate policies on bare `auth.uid()`), portfolio, debts, occasions, `manual_prices`, etc. **SQL test:** loops `pg_policies` for every public table with a `user_id` column and fails if any policy still uses plain `auth.uid()` or a per-row function.
Views and functions (B6): `household_people` is a `security definer` view filtered **inside** by `household_owner()` (it includes `household_former_members`, B7) and tested to return zero rows for non-members; `spending_by_category`, `budget_status`, `portfolio_history` keep invoker rights and replace `auth.uid()` with `household_owner()`; `wallet_balances`/`debt_balances` stay `security_invoker` and follow RLS.

## 5. Invite lifecycle (B4, B5, S2)
Edge Function `invite-member` (Supabase, service role stays inside it; restrictive CORS: stiver.io, staging, preview hosts). Order:
1. `auth.getUser(jwt)`; caller must be an owner (no `household_members` row), checked from tables; **no role is ever read from user_metadata**.
2. **Insert an `invite_attempts` row first**, then rate-limit: max 10 attempts/hour per owner and 3/day per target email (failed attempts count, so "already has an account" cannot be probed unthrottled).
3. Validate email; compute `lower(email)`; member cap (accepted + pending <= 5) inside one transaction with an advisory lock on the owner (concurrent invites cannot exceed the cap).
4. Existing-account check: a confirmed `auth.users` row for the email, or any member, returns one generic error (PRD check 2 copy). A pending invite returns "Already invited".
5. **Insert `household_invites` (pending) BEFORE calling Supabase**, then `auth.admin.inviteUserByEmail(email, {data:{inviter_name, language}, redirectTo})`; if the call fails, delete the invite row. `inviter_name` is sanitised (strip markup, 40 chars) before it reaches the email template (S2).
6. `inviteUserByEmail` creates the `auth.users` row immediately (unconfirmed), which fires `handle_new_user` at invite time: it **still creates the profile row** but **skips seeding** when a pending invite exists for `lower(new.email)` (DB lookup, never metadata).
7. **Revoke/expire/Resend:** revoke and the expiry job call `admin.deleteUser` for the never-confirmed invited user, otherwise the email is stuck as "already registered". Resend re-invites the unconfirmed user (the old token stops working).

`accept_household_invite()`: reads the email from `auth.users` for `auth.uid()` (not a client claim), requires `email_confirmed_at is not null`, matches a pending unexpired invite on `lower(email)`, inserts the membership, marks the invite accepted, writes the display name, bumps `household_state`. `my_pending_invite()` lets any sign-in without a household discover a pending invite (PRD check 16, invite wins).
Link (PRD checks 9, 10): the template links to `{{ .SiteURL }}/join?token_hash={{ .TokenHash }}&type=invite` (our page, no network call on GET). On Join **submit** the client runs `verifyOtp({token_hash,type:'invite'})` -> `updateUser({password,data:{full_name}})` -> `rpc('accept_household_invite')`; scanners never submit forms. If a later step fails the page keeps the session and offers Retry; a used/expired token shows the PRD message. Signed in as someone else: page asks to sign out first (`signOut({scope:'local'})` on tap).

## 6. Triggers vs the client's whole-row upsert (B3)
- BEFORE INSERT: `created_by := auth.uid()`, `updated_by := auth.uid()` (client values ignored), `rev := 1`.
- BEFORE UPDATE: `new.user_id := old.user_id`, `new.created_by := old.created_by`, `new.updated_by := auth.uid()`; the revision check below; `new.rev := old.rev + 1`. (`ON CONFLICT DO UPDATE` sends client values, hence the pinning.)
- Tests: a client sending `created_by` = someone else or a different `user_id` is ignored/rejected; a member cannot write rows with `user_id = own id`.
- Backfill `created_by = user_id` runs in migration 1 **before** the triggers exist (S3), so no `updated_at`/`rev`/log is touched.

## 7. Concurrency and refresh (B2)
- **Compare-and-set:** the client keeps each row's `rev` and sends it back. The BEFORE UPDATE trigger raises `40001` ("stale") when `new.rev` differs from `old.rev`; the client maps it to PRD check 29 ("Updated by X. Please check and redo your change") and reloads that row. Old clients that omit `rev` send an unchanged value (no conflict); they lose the check until their stamped service worker updates.
- **Edits vs inserts:** the client no longer upserts rows it knows exist. New rows `insert`; known rows `update ... where id = ? ` (zero rows updated = "someone deleted this", **rejected, never re-inserted**). Deletes are `delete where id = ? and rev = ?`; zero rows deleted = already changed or deleted, shown as a conflict.
- **Merge (`cloud.js`):** after every poll merge, rebuild **both** `synced` and in-memory state from the merged server rows, otherwise the next diff would re-upsert others' rows or resurrect rows someone else deleted. A merge only runs when the save queue is idle; if there are unsaved local changes it is deferred.
- **Cheap polling:** statement-level AFTER INSERT/UPDATE/DELETE triggers with transition tables bump `household_state.rev` for the distinct owner ids touched. The client polls just that one row on focus and every 30 s while visible and reloads only on change (also the hook for realtime later). Membership changes bump it too, so a role change or removal is noticed (PRD check 19, 20).

## 8. States (B8)
- **Member leaves or is removed:** the membership row is replaced by a `household_former_members` row; the login stays, with no ledger and no seed. The app shows the "no longer have access" page with **Sign out** and **Delete my login** (Edge Function `delete-my-login`, `admin.deleteUser`). Known limitation (to the PRD): a departed person's email still has an account, so it cannot be invited again until they delete the login.
- **Owner deletes the account:** `household_members.owner_id` cascades, member logins remain without a household and see the same page; the owner's delete dialog explicitly lists the members and says they lose access.
- Former members' names: `household_people` includes `household_former_members`; `activity_log` stores an `actor_name` snapshot (B7).

## 9. Client (`prototype/`)
`cloud.js`: after sign-in compute `dataOwnerId` (`household_owner()`), `rowsFromData` sets `user_id: dataOwnerId` including **every composite upsert key** (S5: `manual_prices` `onConflict 'user_id,symbol,price_date'`; all other tables conflict on `id` only), settings read via `household_profile()`, `created_by/updated_by/rev` mapped in `dataFromRows`. Defaults that are about data (`defaultCatId`, onboarding key) follow the data owner; **`Analytics.identify` stays on the member's own auth id** with a new `household_role` property so members do not merge into one PostHog person (S4). Join view built on the existing recovery/`pwField`/consent pieces; `state.household = {owner, role, people}`; one `canWrite()` guard; `onSaveError` maps `40001` and RLS rejections to the PRD messages. Settings > Household card, Activity page (slice 2), row labels, "Added by / Edited by". i18n (`i18n-id.js`), `data-act`/`data-form`, analytics events and catalog.

## 10. Audit log (slice 2)
Per-table whitelist (`transactions`, `wallets`, `categories`, `budgets`, `debts`, `debt_payments`, `investment_accounts`, `holdings`, `holding_events`), row triggers writing `actor_id`, `actor_name`, owner, small `summary`. Skip no-op updates (`to_jsonb(old) - 'updated_at' - 'rev'` equals `to_jsonb(new) - ...`), skip sample-data rows and bulk statements (a statement touching more than 200 rows logs one summary row), and cap high-volume tables (`holding_events`, `debt_payments`: create and delete only).

## 11. Migrations (staging first; additive and backwards compatible; S3)
1. `household_tables`: tables, columns (`created_by`, `updated_by`, `rev`), functions, `household_state`, backfill `created_by = user_id` (no triggers yet).
2. `household_rls`: replaces all policies (loop over `pg_policies`), defaults to `household_owner()`. **Ships with a down script** and its tests run against the **old client's request shapes** too.
3. `household_triggers`: created_by/updated_by/rev triggers, statement-level `household_state` bump.
4. `household_functions`: updated views/functions, `handle_new_user`, `accept_household_invite`, `my_pending_invite`, member RPCs, expiry job.
5. (Slice 2) `household_activity`.
Each migration is applied to staging, SQL tests run, then production at release by Developer 2.

## 12. Developer 2's findings and where they are answered
B1 sections 2, 4 | B2 section 7 | B3 section 6 | B4 section 5 | B5 sections 5, 3 | B6 sections 3, 4 | B7 sections 2, 8 | B8 section 8 | S1 section 3 | S2 section 5 | S3 sections 6, 11 | S4 section 9 | S5 section 9 | S6 section 13.

## 13. Tests
SQL (`supabase/tests`): owner, editor, viewer, removed member, non-member on every table; policy loop (no plain `auth.uid()`); `household_people` zero rows for non-members; spoofed `created_by`/`user_id` ignored; member cannot write `user_id` = own id; cap of 5 under concurrent invites; removed member's JWT loses access on the next query; accept with unconfirmed email fails; seeding skipped for invited emails; rate limit counts failed attempts; old-client request shapes still work for owners. e2e (`tests/e2e/fake_supabase.js` extended: second user, members, `rev` and `40001`, invite/verifyOtp events, `household_state`): join happy path and expired link, Viewer read-only, conflict message, deleted-by-other, poll merge keeps `synced` correct, no-household page. Real staging: two smoke accounts and a real invite to a `+alias` inbox read through the Gmail connector (needs the owner's OK to send the test email).

## 14. Security checklist
No secrets in the repo; service role only inside the Edge Functions; owner-only invite with attempt-based rate limit; generic existence error; single-use link bound to the verified email, consumed only on submit; membership never from user_metadata; minimal activity data; CSP unchanged; every new SQL function has fixed search_path and restricted execute.
