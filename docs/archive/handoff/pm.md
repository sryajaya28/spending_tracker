# PM handoff (2026-11-05)

Read this plus docs/roles/pm.md, docs/DECISIONS.md (tail), docs/WORKSPACE.md. Workspace: https://claude.ai/artifact/SK9TLRLSf8dyyg5EnCvZTt (owner's inbox; read `messages` from owner, `decisions`, `approvals`, `actions`, `backlog`).

## State
- Household access (multi-user): PRD v2.1 + check 16 change + Editor-own-transactions rule + checks 33-39 approved (gate 1), Figma approved (gate 2, 28+ frames, section "Feature - household"). Branch docs/household-prd (PRD, technical design). Full-stack engineer builds on feature/household; Tech-Lead reviews (high-risk lane: auth + DB). Owner did the two staging actions (Confirm email ON on staging, Resend key) on 2026-11-05: staging Confirm email must be switched OFF after spike 2 (ask owner via an Action). Release and production migrations need the owner's chat message.
- Handoff hardening PRD approved (gate 1) and "Too many tries" message approved (fast lane); Full-stack engineer builds after household release; Tech-Lead picks lock numbers. QA plans on qa/household, qa/handoff.
- Release reports: every release starts with a high-level "Items in this release" list (owner 2026-11-05); Tech-Lead is rewriting releases 8-11.
- Token rules: AGENTS.md rule 15 (no acks, pointer relays, no polling).
- Backlog: b-handoff-hardening (working), b-workspace-polish (working), b-old-branches, b-cycle-log (low).

## Next for the PM
1. When the Full-stack engineer reports ready: create an `approvals` item (staging sign-off) with covers/not covered/evidence; later a release item (needs owner chat message).
2. Post-release: read PostHog (EU project 334082, env=production): invite_sent -> invite_accepted funnel; report in 5 lines.
3. Log new owner decisions in docs/DECISIONS.md (docs-only branch, Tech-Lead merges).

## State at 2026-11-05 ~11:30 UTC (written by the Tech-Lead for the PM session replacement; the old PM session was at 585k tokens)
- **Release 15 (household) is in flight.** Owner's release line is in ("also can start merging all the changes, run regression, deploy, and run smoke test also"; decision d-household-real-account-checks answered "Run the real-account checks"). Final build = staging `863473b` (+ docs-only commits after it, e.g. AGENTS.md rule 16). QA's tools/regression.js passed on 863473b; QA is running the real-account household checks (Mailinator invitees, stop at first failure). When QA reports green the Tech-Lead applies production migrations 24-31 one at a time, deploys the 6 Edge Functions, merges staging to main (PR), verifies the build, QA runs the production smoke test. A failure stops everything; tell the owner.
- **Owner Actions:** production secrets and auth settings DONE (a-prod-secrets, a-prod-auth). OPEN, post after the Tech-Lead says "functions deployed": the daily invite-sweep job (Supabase Cron, POST to the production invite-sweep function with the service-role key pasted by the owner in the dashboard; release can go before it exists). Optional new Action: an access token for the Supabase CLI so multi-function deploys do not need repeated pastes (AGENTS.md rule 16).
- **Waiting on the owner after the release:** whether docs/household-prd (PRD + technical design) should be merged; docs/case-study review; the parked support@stiver.io setup (CONTACT_EMAIL already in this release). Remove the stale staging login mailinator accounts after QA (Tech-Lead cleans up).
- **Rule 16 (message economy) applies to you first:** no relays with summaries, one line when you only forward, report to the owner on the Workspace not in long chat replies, hand off at 400k tokens.
