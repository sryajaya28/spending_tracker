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
