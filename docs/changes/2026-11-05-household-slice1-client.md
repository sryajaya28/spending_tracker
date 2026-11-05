# Household slice 1: client, join page, labels, guards, sign-up gate
- Settings > Household card, invite dialog and states, role/remove/leave, `/join` page, no-access page, Viewer read-only states, who-submitted labels, named delete confirmations, "Your access changed" toast, Indonesian strings.
- Guard messages name the item: "Can't delete 'X'. 'X' holds n transactions added by others. Ask the owner." (Figma 27/29).
- A Viewer's app does not generate recurring entries.
- Create account calls `signup-gate`; the "Check your email" screen adds "If you were invited to a household, use the link in your invite email." (PRD check 16).
- Analytics: `invite_*`, `member_*`, `household_left`, `invite_accepted`, `login_deleted` (asserted in `tests/e2e/analytics.js`).
- Tests: `household_join`, `household_labels`, `analytics`, `run`; fake Supabase gained `functions.invoke` for `signup-gate`.
