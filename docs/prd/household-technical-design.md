# Technical design: household access (for Developer 2's review)

PRD: `docs/prd/household.md` (v2). Section numbers below are kept from v1.

### 6.1 Data model — keep `user_id` as the household owner's id
Chosen over adding `household_id` everywhere because every table, composite FK `(id,user_id)`, unique index and trigger already keys on `user_id`; for a member, rows are written with `user_id = owner id`, so **no existing FK, index or constraint changes**.

New tables (all RLS on, anon revoked):
- `household_members(owner_id uuid, member_id uuid unique, role text check in ('editor','viewer'), added_at, primary key(owner_id, member_id))`. One household per person (`member_id` unique); an owner cannot be a member (check in function).
- `household_invites(id uuid pk, owner_id, email citext, role, invited_by, created_at, expires_at, status check in ('pending','accepted','revoked','expired'), unique (owner_id, email) where status='pending')`.
- `activity_log(id bigint identity, owner_id, actor_id, entity text, entity_id, action text check in ('create','update','delete'), summary jsonb (a few fields: name/amount/currency/type, never more), at timestamptz default now())` + index `(owner_id, at desc)`; 180-day purge (scheduled).

New columns: `created_by uuid`, `updated_by uuid` on `wallets, transactions, categories, budgets, investment_accounts, holdings, holding_events, debts, debt_payments, occasions, recurring_rules`, set by a `before insert/update` trigger from `auth.uid()` (client cannot spoof). Existing rows: `created_by = user_id`.

Helper functions (security definer, stable, `search_path=''`): `household_owner()` = owner id of the caller (self if owner), `can_read(owner)`, `can_write(owner)`. RLS on every money table becomes: select `can_read(user_id)`; insert/update/delete `can_write(user_id)` (wrapped as `(select …)` for the planner). `profiles` stays self-only; a view `household_people` (user_id, display_name, role) lets members see each other's names. Update the `auth.uid()`-filtered functions/views (`spending_by_category`, `budget_status`, `portfolio_history`) to use `household_owner()`. `handle_new_user` skips seeding when a pending invite exists for the new email (DB lookup, never client metadata).

### 6.2 Invite and accept flow (server side)
- **Edge Function `invite-member`** (Supabase, service role available there, no new Vercel secret): verifies caller JWT is an owner → rate limit → email format + not an existing confirmed account (generic error) + member cap → insert `household_invites` → `auth.admin.inviteUserByEmail(email, {data:{inviter_name, role}, redirectTo: appUrl()})`; Resend for a pending invite calls it again. Revoke/role-change/remove are plain RPCs checked by `can_write`/owner only.
- **RPC `accept_household_invite()`** (security definer): requires the caller's JWT email to match a pending, unexpired invite and the email confirmed; inserts `household_members`, marks the invite accepted, writes the profile name. **Membership never comes from user_metadata** (a normal sign-up can send any metadata, so it is not trusted).
- Email: customise the existing Supabase **Invite** template (`tools/build_email_templates.py`, `{{ .Data.inviter_name }}`, role) in EN/ID; **owner action:** paste into the Supabase dashboard for staging and production (Supabase MCP cannot edit auth templates). Redirect URL `stiver.io/**` is already allowed.

### 6.3 Client (`prototype/`)
- `cloud.js`: after sign-in compute `dataOwnerId` (owner id if member, else self); `rowsFromData` sets `user_id: dataOwnerId`; load reads owner's profile for household-level settings and the member's own profile for personal ones; pass `created_by/updated_by` through `dataFromRows`. `state.auth.uid` users (`defaultCatId`, onboarding key, analytics identify) switch to the data owner where they are about data.
- Boot: detect the invite link (`type=invite` in the URL hash, captured before supabase-js clears it) → new **Join household** view built on the existing recovery/`pwField`/consent pieces (`app.js` ~1643, 3239-3300), then `accept_household_invite()` and continue signed in.
- Role in state (`state.household = {owner, role, people[]}`); one `canWrite()` guard hides Add/Edit/Delete controls for Viewers; `onSaveError` shows "Your access changed" when RLS rejects.
- Settings > **Household** card (between Smart tagging and Account): members list with role badges, Pending rows with Resend/Revoke, Invite dialog, role/remove actions (owner), Leave (member). New **Activity** page.
- Attribution UI: "Added by / Edited by" on transaction rows and detail, account/debt/investment cards; avatar initials shown only when the household has >1 person.
- i18n strings in `i18n-id.js`; `data-act`/`data-form` + analytics events + `docs/ANALYTICS.md`/`EVENTS.md`.

### 6.4 Audit log
Row triggers on the money tables write `activity_log` (actor = `auth.uid()`, owner = row `user_id`, small summary). RLS: members read their household's log; no one writes it directly. Bulk/diff-sync saves create one log row per changed row.

### 6.5 Concurrency (biggest risk)
Today: one load at sign-in, last-write-wins diff saves, no realtime. With two writers I add: **refresh on app focus and every 30 s while visible**, merging only when there are no unsaved local changes; and **optimistic concurrency** on update (`updated_at` compare via the upsert; a conflict shows "Updated by X, reload" and re-fetches instead of overwriting). Realtime subscriptions are a later upgrade, not v1.

### 6.6 Migrations (staging first; backwards compatible)
1. `household_tables` (members, invites, activity_log, columns, helper functions) — additive, old client still works (owner path unchanged).
2. `household_rls` (new policies, replaces `user_id = auth.uid()` with `can_read/can_write`; owner behaviour identical).
3. `household_triggers_audit` (created_by/updated_by triggers, activity log triggers, backfill `created_by`).
4. `household_functions` (update `spending_by_category` etc., `handle_new_user`, `accept_household_invite`, purge job).
Each applied to staging, SQL RLS tests run (`supabase/tests`), then production at release.

## 7. Security / privacy checklist
No secrets in repo; service role only inside the Edge Function. Invite endpoint: owner-only, rate limit (e.g. 10/hour), generic "can't be invited" for existing accounts (accepts the small account-enumeration leak you asked for, limited to signed-in owners). Single-use, expiring link; membership bound to the verified email. Activity log holds minimal fields. RLS tests for each role on every table; Viewer write must fail; removed member must lose access immediately. CSP unchanged.

## 11. Changes in v2 (after the Product Manager's review)

- **Link is consumed only when the password is set (PRD checks 9, 10).** Mail scanners prefetch links, and Supabase's default invite link (`/auth/v1/verify?token=...`) is consumed on the first GET. The invite email template instead links to our own page: `{{ .SiteURL }}/join?token_hash={{ .TokenHash }}&type=invite`. That page only reads the hash (no network call). On **submit of the Join form** the client runs, in order: `auth.verifyOtp({token_hash, type:'invite'})` (consumes the token, creates the session) -> `auth.updateUser({password, data:{full_name}})` -> `rpc('accept_household_invite')`. A prefetching scanner never submits a form, so the link survives. If a step after `verifyOtp` fails (network), the page keeps the session and offers Retry for the remaining steps; if the token is already used or expired the page shows the PRD message (no token detail leaks). Template change is part of the owner's dashboard paste (staging and production).
- **Invite wins on a normal sign-up (check 16).** `accept_household_invite()` is keyed on the caller's verified email, not on the route they came by: if a person who was invited signs up through "Create account" and confirms that email, the first sign-in calls the same RPC (client checks `rpc('my_pending_invite')` after any sign-in that has no household) and joins the household. `handle_new_user` skips seeding for any email with a pending, unexpired invite, so there is never a separate empty ledger.
- **Link opened while signed in as someone else (check 15).** The Join page reads `getSession()` first; if a session exists for a different email it shows "You're signed in as X. Sign out to join" and calls `signOut({scope:'local'})` only on tap, then continues with the token. Device independent because the token is in the URL.
- **No-household state (check 20).** `Cloud.load` returns `{household:null}` for an authenticated user who is neither an owner with data nor a member; the app shows the "no longer have access" page with Sign out only. Removal and leave delete the `household_members` row; RLS stops reads at once; the 30 s refresh or the next failed save routes to that page. Membership changes also bump `profiles.updated_at` so the refresh can detect a role change (check 19).
- **Slices.** Slice 1: migrations 1 and 2, the `created_by/updated_by` triggers and `household_people` view (migration 3 without the audit triggers), Edge Function, `accept_household_invite`/`my_pending_invite`, Join page, Household card, roles, removal/leave, row labels and "Added by / Edited by", delete confirmations naming the item, focus/30 s refresh and the `updated_at` conflict check. Slice 2: `activity_log` table and audit triggers (migration 4 part) and the Activity page. The who-filter and per-person split are v1.1.
- **Email language (open question 4).** The invite is sent in the owner's language (`data.language` from the owner's profile); the Join page has the existing language switch.
- **Account existence message.** The Edge Function returns one generic error for "already has an account" and "cannot be invited"; the app shows the PRD check-2 copy. Rate limit and owner-only check apply before any existence lookup.
