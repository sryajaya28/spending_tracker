---
description: Compile a CEO brief for a gate. Usage: /ceo-brief <slug> predev|demo
argument-hint: <slug> predev|demo
---

You are the orchestrator. Arguments: $ARGUMENTS (slug and gate).

1. Read docs/features/<slug>/status.md and docs/team-protocol.md Section 4 (Flows CEO1 and CEO2).
2. Check preconditions. Refuse and explain if they are not met.
   - predev: state must allow it, and prd, design, and tdd approvals must all exist and be valid (hashes match current files).
   - demo: uat-signoff.md must exist with RECOMMEND SIGN-OFF, qa-staging-report.md must have a GO recommendation, and the staging build id must match the build QA tested.
3. Invoke the product-manager subagent to compile docs/features/<slug>/ceo-brief-predev.md or ceo-brief-demo.md from docs/templates/ceo-brief.md, using only approved artifacts. Pass the artifact paths and their current hashes.
4. For the demo gate, also confirm the staging build is reachable and the synthetic test accounts exist in the secret manager. If not, stop and tell the CEO what is missing. Do not open the gate with an unusable build.
5. Verify the brief: every artifact hash matches, every known defect and Not covered item from the QA report appears, the Objections section includes the reviewer objections verbatim, and no CEO decision text is present.
6. Set status.md state to CEO_PREDEV_REVIEW or CEO_RELEASE_REVIEW. Stop all work on this feature.
7. Tell the CEO in a short message: the decision needed, where the brief is, what to look at or use (links and install steps), and the four options: approve, approve with conditions, request changes, reject.

Never write a CEO decision. Never continue the feature until /ceo records one.
