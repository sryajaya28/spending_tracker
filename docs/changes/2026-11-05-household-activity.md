# Household slice 2: Activity page
- Migration 31 `activity_log`: triggers on the money tables log who added, edited or deleted what (household with members only), kept 180 days, readable by every member including Viewers, not writable by clients. Not applied to production.
- Settings > Household > Activity opens `#/activity`: day groups, person and type filters (All, Added, Edited, Deleted, Balance), "was ..." and balance lines, empty states, Viewer note. Indonesian strings.
- Event `activity_opened` (no properties). Tests: `household_activity` (e2e), `household_activity.test.sql` (13), `analytics`.
- Known limit: the page loads the latest 300 rows and filters them on the device.
