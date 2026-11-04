# Household access (multi-user) — PRD, technical design and plan

Status: v1 DRAFT, owner approved the direction (2026-11-04); waiting for **Product Manager review**, then Developer 2's technical review and the Designer's Figma work. No code, no migration, no Figma yet. Author: Developer 1.

## 1. Context

Stiver today is one login = one ledger. Every money row has one `user_id` and RLS is `user_id = auth.uid()`; nothing records who changed a row; data loads once at sign-in with no live refresh and last-write-wins saves.
Families want to run household finances together. The owner (account creator) invites other people by email, as **Editor** (read + write) or **Viewer** (read only); everyone sees the same data and every change shows who made it.

Decisions already made by the owner (2026-11-04): invitee is **signed in straight after creating the password**; **Editor can do everything except household admin**; invitee login is **household-only, one household per person, in v1**; v1 has **row labels + an Activity log**. Rule from the owner: an email that already has a Stiver account **cannot** be invited.

## 2. Goals / non-goals

Goals: (G1) invite by email with a role; (G2) invitee accepts from the email, creates a password, lands in the household; (G3) role enforced by the database, not only the UI; (G4) clear attribution of who created, edited or deleted anything; (G5) owner manages members (change role, remove, revoke, resend); (G6) no data loss or silent overwrite when two people use it at once.
Non-goals (v1): invitee with their own separate ledger or a household switcher; several admins or ownership transfer; per-account privacy ("hide this account from Viewers"); comments, approvals, chat; push notifications; undo of others' changes; sharing with an existing Stiver account.

## 3. Roles and permissions

| Action | Owner | Editor | Viewer |
|---|---|---|---|
| See all data, Activity log, members list | yes | yes | yes |
| Add / edit / delete transactions, transfers | yes | yes | no |
| Add / edit / archive / delete accounts (savings, debt, lent, investment), change balances | yes | yes | no |
| Budgets, categories, occasions, recurring rules | yes | yes | no |
| Invite, resend, revoke, change role, remove member | yes | no | no |
| Household currency, budget period day, sample-data toggle, delete the account | yes | no | no |
| Personal: own name, language, theme, sign out, **leave household** | yes (no leave) | yes | yes |

## 4. Key user stories and acceptance checks

1. **Invite.** Settings > Household > Invite: email + role (Editor/Viewer). Checks: invalid email rejected; an email that already has an account shows "This email can't be invited" (no other detail); a pending invite to the same email says "Already invited" with Resend; a successful invite shows the person as "Pending" with role and date; max 5 members including owner.
2. **Email.** Invite email names the inviter, the role, and has one **Accept invitation** button; the link works once and expires (owner can resend). The email is in English and Indonesian (follows the owner's language).
3. **Join page.** Link opens "Join <owner name>'s household": shows role, asks for display name, password (show/hide) and the Terms/Privacy tick box (same rule as sign-up). After submit the invitee is signed in and sees the household. Expired/used link shows a clear page with "ask the owner to resend".
4. **Viewer is read-only.** Add buttons and edit controls are hidden/disabled for Viewers, and a direct write is rejected by the database (tested).
5. **Attribution (owner request: see who submitted a transaction, so everyone knows who did what with the money).** Every **row in the Transactions list** (and on Overview's recent list) shows the submitter's name/avatar at a glance, e.g. "Rina · Groceries"; the transaction detail shows "Added by X, date/time" and "Edited by Y, time" if changed; the same on accounts, debts, lent, investments and budgets. Shown whenever the household has more than one member (a solo owner sees no clutter). Transactions can be filtered by person; **Activity** page lists add / edit / delete / balance change by person with time (filterable by person and type; kept 180 days). Names come from `household_people`; a removed member's past entries keep their name.
6. **Manage members.** Owner can change a role (applies at once, even to a signed-in person), remove a member (loses access at once; their past entries stay labelled with their name), revoke a pending invite. A member can leave the household.
7. **Freshness.** A change by one person appears for the others within about 30 seconds or when they return to the app; a stale edit never silently overwrites a newer one (see 6.5).
8. **Safety.** Invites are rate-limited; only the owner can invite; membership is granted only to the verified email the invite was sent to.

## 5. Things you didn't list that I added (please confirm or cut)

- Role changes, remove, revoke, resend, member **leave** (above).
- **Activity log** including who deleted something (the only way to trace deletes) — your choice.
- **"Who" filter** on Transactions and a small per-person spending split on the household Overview (v1.1 if you want it smaller).
- Household-level settings (currency, period day) editable by the owner only; language/theme stay personal.
- Invite **expiry and resend**, one-time link, 5-member cap, rate limit.
- Terms/Privacy tick box on the join page (matches Release 3).
- Removed-access handling: if a member is removed or demoted while the app is open, they see "Your access changed" and the app reloads.
- Owner deleting the account warns that members lose access.
- Analytics events (no emails, names or ids): `invite_sent`, `invite_resent`, `invite_revoked`, `invite_accepted`, `member_role_changed`, `member_removed`, `household_left`, `activity_opened`.
- Out for later: own ledger per invitee, several admins/transfer ownership, hide-an-account, realtime push, undo.

## 6. Technical design (for Developer 2's review)

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

## 8. Delivery plan and gates (your required order)

Team (sessions set up by Developer 2): **Product Manager** (session "Stiver: Product Manager"), **Designer** ("Stiver: Designer"), **QA** ("Stiver: QA"), Developer 1, Developer 2.

| # | Step | Owner of step | Gate |
|---|---|---|---|
| 0 | Owner approves this plan as the starting brief (done: owner said OK, 2026-11-04) | **You** | Done |
| 0b | I commit the PRD to the repo (docs only, branch `docs/household-prd`, `docs/prd/household.md`) and message the **Product Manager** with the branch + commit and the owner's brief; PM reviews scope, roles, acceptance checks and the "additions" list, edits the PRD if needed | **Product Manager** | PM replies "approved <commit>" or numbered findings; one round; I fix findings |
| 0c | PM tells the **Designer** the PRD is approved (I also message the Designer the commit); **QA** gets the same commit to start the test plan | PM / Dev 1 | Designer and QA acknowledge |
| 1 | **Technical design review** | **Developer 2** | "approved <commit>" or numbered findings; one round (can run in parallel with step 2) |
| 2 | **Figma UI/UX** in "Stiver" file, section `Feature - household`: Settings > Household, Invite dialog, Pending/Accepted states, invite email, Join page, Viewer (read-only) states, attribution on rows/detail, Activity page, removed-access, error/expired link; light, dark, phone, wide; flow with arrows. Starts **only after the PM approves the PRD** | **Designer** | **You approve the design** |
| 3 | Build on `feature/household` in slices (migrations 1-4 on staging, RLS tests, Edge Function, client, Activity, Figma-matching UI); feature tests first in `docs/FEATURE_TESTS.md`; analytics; i18n; change files | Developer 1 | tests + SQL RLS tests pass |
| 4 | **Code peer review** (production code) | Developer 2 | "approved <commit>" |
| 5 | Developer 2 merges to staging; I send staging link, screenshots, steps | Dev 2 / Dev 1 | **You sign off on staging** |
| 6 | Regression on staging **only when you ask**, incl. two real accounts + a real invite email | Dev 1/2 | You approve the summary |
| 7 | Release: migrations to production first, then code, production smoke test | Developer 2 | Your release approval |

Fast lane does not apply (large, touches data and security).

## 9. Verification (how we will prove it works)
- **SQL RLS tests** (`supabase/tests`): owner, editor, viewer, removed member, non-member on every money table; `created_by` cannot be spoofed; invite accept only with matching verified email; seeding skipped for invitees.
- **e2e** (extend `tests/e2e/fake_supabase.js` with a second user, `household_members`, an invite/recovery event and an `rpc` stub): owner invites; Viewer sees no write controls; Editor adds a transaction and the label shows; remove member; leave; role change while open; join page happy path and expired link; poll refresh and conflict message.
- **Real staging** (`tests/staging`): two smoke accounts plus a real invite to a `+alias` inbox we can read through the Gmail connector (needs your OK to send those test emails), accept it, edit from both sides, check Activity and attribution, clean up.
- **Real-browser proof** with `tools/staging_shot.js` (phone and dark) for the new screens; smoke test unchanged and run after release.

## 10. Risks and open items
- Concurrency (6.5) is the main engineering risk; v1 mitigation is refresh + conflict check, not realtime.
- Supabase invite-link lifetime is set in the dashboard (OTP expiry); we will set and document it, and Resend covers expiry.
- Email templates and Edge Function secrets/deploy need **owner actions** in the Supabase dashboard (staging and production): paste templates, confirm SMTP, set OTP expiry. I will give exact steps.
- Existing production owners are unaffected (owner path identical); migrations are additive first.
- Estimated size: large (about 4 migrations, 1 Edge Function, ~8 UI surfaces). I would build in 3 slices behind the Figma approval; the owner can ship the first slice (invite + join + roles + RLS) before Activity if wanted.
