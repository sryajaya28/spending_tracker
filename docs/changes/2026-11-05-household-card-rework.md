# Household card rework (fast lane, owner 2026-11-05)
- Accepted member rows (not the owner's own) get a visible "Manage" button (role chips, Remove, Save). The grey "Tap a person..." hint is gone.
- Role badge sits right after the name, email under it, on every row including the Editor/Viewer view.
- Pending row: "Pending" badge on the name line; Resend and Revoke on one line (text buttons on desktop, icon buttons at phone width with accessible labels "Resend invite" / "Revoke invite" and the full email as title); long names and emails truncate with an ellipsis.
- Remove confirm: "<name> will lose access to <owner>'s household. Things <name> added keep <name>'s name."
- The Activity row moved below Invite someone (Figma 48:5). Indonesian strings added. Analytics events unchanged. Test: `household_activity` (card assertions at 390 px).
- Migration 31 is the single final file (includes the was_* body, as on staging); there is no migration 32.
