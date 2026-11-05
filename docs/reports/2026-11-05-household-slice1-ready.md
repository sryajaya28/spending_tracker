ready: feature/household (c10b29f)   tests: 57/57 e2e pass (full suite, run twice), local SQL 128/128 (tables 12, hardening 9, rls 37, functions 44, guards 26)
Request: owner's household feature, slice 1 (invite, join, roles, who-did-it labels, guards)   Design: Figma "Stiver" > Features > "Feature - household" (29 approved frames)
Acceptance checks:
  [x] Guard messages name the item (frames 27/29) -> `household_labels` asserts the exact text.
  [x] Viewer's app generates no recurring entries; Editors may edit rules/categories/occasions (PRD 18) -> `household_labels` asserts runRecurring()=0 for a Viewer.
  [x] invite_accepted / login_deleted tracked, no private data -> `analytics` (event asserted, only `role` property).
  [x] Create account uses signup-gate, "Check your email" + invite hint (PRD check 16) -> `run` asserts the hint and the gate call payload; fake backend only.
  [x] Phone (390) + dark look of Household card, invite dialog, no-access, Join -> local screenshots against the fake backend (8 PNGs); one defect found and fixed (EN/ID chips overlapped the logo on the Join page).
  [ ] Real two-person edit on staging (stale 409, "gone") -> not checked: the branch is not on staging yet.
  [ ] Staging smoke 15/15 with this client -> not checked for the same reason.
  [ ] Screens compared pixel-by-pixel with Figma -> not checked; compared by eye only for the four screens above.
Real-browser proof: local Chromium + fake Supabase (not staging_shot.js, which needs the branch deployed).
Differences from the design: none known (guard text uses one combined sentence per Figma 27/29).
Reviewed by: pending, Tech-Lead
Not verified: invite-sweep with the real service key; GoTrue weak 8-char passwords (accepted); refresh token after removal (accepted); real email only on staging; production untouched.
Decisions needed: none
Owner-bound asks: all on the Workspace (yes) - none from this slice
Migrations: none new in this step (24-30 already on staging). Activity (migration 31) not built.
Steps to try: 1. Settings > Household > Invite someone. 2. Open the emailed link, join. 3. As Editor try deleting an account used by the owner's entries.
Changelog file: docs/changes/2026-11-05-household-slice1-client.md
