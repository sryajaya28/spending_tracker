# PRD: Household access (multi-user)   (owner brief date: 2026-11-04)

Status: `PRD v2 | owner approved: 2026-11-04 (v2.1) | Figma: pending | Branch: docs/household-prd | QA report: pending`
v2 answers the Product Manager's review of v1 (4 blocking, 7 suggestions). Changes after owner approval need the owner's decision (see 'Pending owner decisions' in the technical design). v2.1 = v2 plus the owner-approved 'Delete my login' and leave/owner-deleted clarifications. Technical design: `docs/prd/household-technical-design.md` (for Developer 2).

## 1. Problem and goal
Owner's words: "multi-account is allowed. The admin (the account creator) can send an invite through email for another user to access the account also, either to write and read or read-only. The use case is for family to manage their household financial." And: "on transaction can see who submit the transaction, so they know who do what with the money."
Today one login is one ledger, so a family cannot share it, and nothing says who entered what. Goal: an owner invites family by email as Editor or Viewer; everyone sees the same household data; every record shows who made it.
Owner decisions: invitee is signed in straight after creating the password; Editor can do everything except household admin; household-only login in v1 (one household per person); an email that already has a Stiver account cannot be invited.

## 2. Scope
**In (slice 1):** invite by email (Editor/Viewer), pending list, resend/revoke, join page (create password), roles enforced by the database, change role / remove / leave, who-submitted labels on rows, "Added by / Edited by" on records, delete confirmations that name the item, refresh so people see each other's changes.
**In (slice 2, same v1 release train):** Activity page (adds, edits, deletes, balance changes by person).
**Out:** an invitee with their own separate ledger or a household switcher; several admins / transfer of ownership; hiding an account from some members; comments or approvals; push notifications; undo of others' changes; inviting someone who already has a Stiver account; realtime push (refresh instead).
**Later (v1.1):** "Who" filter on Transactions, per-person spending split on Overview, optional own ledger for members.

## 3. User stories
- As an **owner** I can invite a family member as Editor or Viewer so that they can see or help manage our money.
- As an **owner** I can change a person's role, remove them, or cancel a pending invite so that I stay in control.
- As an **invitee** I can accept from the email, create a password and land in the household so that I can start right away, and sign in later with email and password.
- As an **editor** I can add and change transactions and accounts (savings, debt, lent, investment) so that I can help keep the books.
- As a **viewer** I can see everything but change nothing so that I can stay informed safely.
- As **any member** I can see who submitted each transaction and who added or changed each account so that we know who did what with the money.

## 4. Acceptance checks (Given / When / Then)
Invite
1. Given I am the owner on Settings > Household, when I enter a valid email, choose Editor or Viewer and tap Send invite, then the person appears as "Pending" with role and date, and an invite email is sent.
2. Given an email that already has a Stiver account (any letter case), when I invite it, then I see exactly "This email can't be invited. If they already use Stiver, they need to use a different email address." and nothing is created or sent.
3. Given a pending invite, when I invite the same email again, then I see "Already invited" with Resend; Resend sends a fresh email and the old link stops working.
4. Given an invalid email, then Send invite is disabled with an inline message. Emails are compared without regard to letter case.
5. Given the household has 5 people (members plus pending, owner included), then Invite is disabled with "Household is full (5)". (Owner to confirm the cap.)
6. Given the invite dialog, then it says "They will see all your data, including notes and the names of other members."
7. Given I am an Editor or Viewer, then the Household card shows no Invite, role or Remove controls and no household-level settings (currency, period day) are editable.
Email and link
8. Given an invite email, then it names the inviter and the role, has one "Accept invitation" button, and is in the owner's language (English or Indonesian).
9. Given the invite link is opened (including by an email scanner that prefetches links), then nothing is consumed and the Join page shows. Given the invitee sets a password and submits, then the link is consumed; opening it again shows "This invitation was already used or has expired. Ask <owner> to send a new one."
10. Given an expired or revoked link, then the same message shows and nothing else happens.
Join and sign in
11. Given the Join page, then it shows "<owner> invited you to join their household as Editor/Viewer", a display name, a password (at least 8, show/hide) and the Terms/Privacy tick box; the button stays disabled until valid and ticked.
12. Given a valid submit, then the invitee is signed in and sees the owner's accounts and transactions (not an empty ledger) and appears in the member list.
13. Given the invitee signs out, when they sign in with email and password, then they land in the household with the same data.
14. Given the invitee uses "Forgot password" and sets a new one, then sign-in works and lands in the household.
15. Given the link is opened while another person is signed in on this browser, then the page says "You're signed in as <name>. Sign out to join <owner>'s household." and nothing changes until they do. Given it is opened on another device, it works the same way.
16. Given an invited email signs up through "Create account" before accepting and confirms that email, then the pending invite is honoured and they land in the household (never in a separate empty ledger).
Roles
17. Given a Viewer, then no screen shows Add, Edit or Delete controls, a deep link to add shows a read-only message, and a direct write to the database is rejected.
18. Given an Editor, then they can add, edit and delete transactions, transfers, accounts (savings, debt, lent, investment), budgets, categories, occasions and recurring rules.
19. Given the owner changes a signed-in person's role, then within 30 seconds or when they return to the app it takes effect and they see "Your access changed".
20. Given a person is removed or leaves, when they next use or sign in to the app, then they see "You no longer have access to <owner>'s household." with **Sign out** and **Delete my login** as the only actions; their past entries keep their name. Editors and Viewers can leave from the Household card (the owner cannot); if the owner is removed or deletes their account, members see the same page and any pending invite shows the expired message.
21. Given the owner revokes a pending invite, then it disappears from the list and its link shows the expired message.
Who did it
22. Given the household has two or more people, when I view the Transactions list or Overview's recent list, then each row shows who submitted it (name or initial).
23. Given a transaction, then its detail shows "Added by <name>, <date time>" and, if someone edited it, "Edited by <name>, <time>".
24. Given accounts, debts, lent, investments and budgets, then each shows "Added by <name>"; when someone changes an account amount or balance it shows "Edited by <name>, <time>".
25. Given the household has only the owner, then no labels or avatars appear anywhere.
26. Given a removed member's earlier entries, then they keep that member's name.
Safety and freshness
27. Given I delete a transaction or account, then a confirmation names the item ("Delete account 'BCA'?") before it happens.
28. Given person A adds a transaction while person B has the app open, then B sees it within 30 seconds or when returning to the app.
29. Given person B changed a record after person A loaded it, when A saves a change to that same record, then A sees "Updated by <B>. Please check and redo your change" and B's change is not overwritten.
30. Given someone who is not the owner, when they try to invite, change a role or remove a member (through the app or directly), then it is rejected; more than 10 invites in an hour is limited with a message.
31. Given a normal sign-up that claims to belong to a household in its details, then it gets no access.
32. (Slice 2) Given the Activity page, then it lists adds, edits, deletes and balance changes with person, item and time, newest first, filterable by person and type, for 180 days (owner to confirm), readable by Viewers.

## 5. Edge cases and rules
Dark mode and 390 px phone width for every screen; Indonesian text for all new strings; email addresses are case-insensitive; very long names truncate with an ellipsis; a failed save shows the existing error toast and reloads; a Viewer opening a write link sees a read-only message; if account deletion exists, its dialog lists the members and warns they lose access, and they then see the "no longer have access" page. Known limitation in plain words: someone who already has a Stiver account cannot join a household in v1; they must use another email address (copy in check 2). This includes a person who left or was removed: they must tap Delete my login before they can be invited again. Viewers see everything, including notes and other members' names and emails.

## 6. Data and privacy
Stores: memberships, invites (email, role, status), who created or last changed each record, and (slice 2) an activity log with a few fields (item name, amount, currency, type). Migrations are additive first and backwards compatible (see technical design). **Never to analytics:** emails, names, ids, amounts, notes. Invitation links are single use and bound to the invited, verified email.

## 7. Analytics and success metric
Events (snake_case, no private data): `invite_sent`, `invite_resent`, `invite_revoked`, `invite_accepted`, `member_role_changed`, `member_removed`, `household_left`, `activity_opened`.
Success metric (targets for the owner to confirm): within 30 days of release, at least 3 households with two or more people, and at least 60% of `invite_sent` followed by `invite_accepted` within 7 days. PostHog (EU project 334082, `env = production`): funnel `invite_sent` -> `invite_accepted` (7-day window), plus the count of `invite_accepted` events over 30 days.

## 8. Design notes
Screens: Settings > Household card (members, roles, Pending rows with Resend/Revoke), Invite dialog (with the privacy line), invite email (EN and ID), Join page and its error states (expired/used, signed in as someone else), "No longer have access" page, Viewer read-only states, row labels on Transactions and Overview, transaction detail "Added by / Edited by", account/debt/lent/investment/budget labels, "Your access changed" notice, delete confirmations, Activity page (slice 2). Light, dark, phone, wide, with a flow. Reuse the existing card, chip, badge, dialog and password field (show/hide, consent tick box) components. Designer fills the Figma link.

## 9. Open questions (recommended default each)
1. Member cap 5 and Activity retention 180 days: confirm. Default 5 / 180.
2. Editors may delete accounts and data (owner decision). Deletes are only traceable in Activity (slice 2): default is a confirmation that names the item in slice 1 and Activity in slice 2; alternative is soft delete.
3. What a removed or departed member sees next time: default is the "no longer have access" page with Sign out only; alternative is letting them start their own ledger (v1.1).
4. Invite email language: default the owner's language; the Join page has a language switch.
5. Slice order: slice 1 (invite, join, roles, security, row labels) ships first; Activity follows. Default: ship slice 2 in the same release train if ready, else separately.
6. A normal sign-up for an already-invited email: default the pending invite wins (check 16). **Pending owner decision (security, see technical design section 15 D2):** replace with "Check your invite email", no account created.
7. A departed member keeps a login without a household (household-only v1): **decided by the owner 2026-11-04: Delete my login on the no-access page (option 1).**

## 10. Release plan
Lane: feature (full flow, no fast lane; touches data and security). Migrations (additive, staging first, production at release by Developer 2). Owner actions in the Supabase dashboard (staging and production): paste the new invite email template, confirm SMTP, set the invite-link expiry. Slice 1 first, then slice 2; v1.1 later. How we know it worked: the PostHog funnel and counts in section 7.
