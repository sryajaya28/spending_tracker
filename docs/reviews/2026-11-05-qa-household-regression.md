# QA regression summary: household release, staging 863473b (2026-11-05)

Requested by the owner ("run regression on staging, then deploy and run smoke test"), relayed by the PM.

## Result of `node tools/regression.js` (clean run on 863473b)
| Step | Result |
|---|---|
| browser suite (all e2e, includes household_join, household_labels, household_activity, analytics) | PASS |
| staging smoke test (smoke.staging account) | PASS |
| real-database regression: create | PASS |
| real-database regression: cleanup | PASS |
Script verdict: all passed, "release". Contents: 67 files since production (38 outside docs/tooling). Exact contents: `node tools/release_contents.js` (Tech-Lead).

Extra check requested by Tech-Lead: contact address. `privacy.html` and `terms.html` on staging show `support@stiver.io` as a `mailto:` link at 390 px: PASS (2/2).

## A first run failed, and I caused it (evidence)
- Run 1 (on 9fd9199, then restarted on 863473b because the final build changed) was killed by me mid-way, before its cleanup step. The smoke staging account then held every regression record twice (queried: 4 SMOKE debts, 2 SMOKE bank wallets, 14 transactions = 2 of each kind).
- The next run on 863473b failed 3 create checks (cash, realized P&L, repeating debts) with doubled numbers, and its cleanup failed with `transactions_source_chk` (23514) because the script only removes the first matching account.
- I deleted only my leftovers on the staging smoke account with exact guards (user, `SMOKE bank`, `SMOKE broker`, `SMOKE%` debts); afterwards 0 transactions, 0 debts. The rerun on the clean account passed all four steps.
- Not proven: that cleanup is robust when duplicates exist (a failed save leaves the data intact, so no harm done). Suggestion, not blocking: make `tests/staging/regression.js cleanup` remove every match, not only the first.

## NOT run (so not verified)
The household plan (`regression_scenario.md` section 16, HH-01..HH-45) was NOT run by me against real accounts. Covered only by the e2e files above (stubbed) and the Full-stack engineer's SQL tests, which I did not re-run:
- Real invite emails and link handling: HH-01..03, 08..16 (0 of the ~6 approved test emails used).
- Database-level access checks, high-risk lane: HH-17, 30, 31 (Viewer / non-owner direct writes, spoofed sign-up), HH-39, 44, 45 (Editor rules by direct REST), HH-05 cap, HH-09/10 (scanner prefetch does not consume the link).
- Removal / role change while the app is open (HH-19, 20, 35, 36), conflict check (HH-29), freshness (HH-28).
- Dark mode and 390 px proof of the household screens, Indonesian text.
- Invite-sweep with the real service key (not covered by anyone). Production smoke test (runs only after deploy).

## Recommendation
The standard regression is green and shows no regression for existing solo users on staging. The household access rules are the risky part (sign-in, invites, row-level security) and I have not verified them with real accounts. I recommend running HH-17/30/31/39/44/45 and the link checks 9-10 first (needs the staging DB and about 2 test emails), then releasing. If the owner prefers to release now, the unverified list above is the risk they accept.

Owner-bound asks: all on the Workspace (yes/no): no, none made by QA; PM to relay this summary.
