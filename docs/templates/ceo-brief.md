---
gate: predev | release
feature: <slug>
version: <n>
prepared_by: product-manager
artifacts_hashed: []
build_id: <build id for release gate, null for predev>
---

# CEO Brief: <feature name> (<Pre-development review | Release review>)

Decision needed from you: <one sentence, e.g. "Approve building this, or tell us what to change.">
Needed by: <date or "no deadline">
Time to review: <estimate, minutes>

## 1. Summary (one page, plain words)
- Problem and who has it:
- Why now:
- What we are building:
- What we are NOT building:
- Expected outcome and the metric that proves it (baseline, target, when read):

## 2. What changed since you last saw this
<First version: "Not applicable". Later versions: bullet list of every change and why.>

## 3. Pre-development gate only: what to review
| Item | Link | Hash |
|---|---|---|
| PRD (FR and NFR list inside) | | |
| User flow | | |
| System flow | | |
| Design prototype (clickable) | | |
| Design state gallery (loading, empty, error, offline, permission) | | |
| Copy (every string) | | |
| Technical summary (approach, key risk, effort, cost) | | |

Technical summary for non-engineers:
- Approach:
- Biggest technical risk:
- Effort and timeline estimate (from approved TDD):
- Cost at expected scale:

## 4. Release gate only: use the product
- Build id you are looking at:
- How to access: <URL or install steps for iOS, Android, web, PWA>
- Test accounts: delivered through the secret manager, not in this file
- Demo script (5 to 10 steps, expected result for each):
  1.
  2.
- The two riskiest edge cases to try:
  1.
  2.

### What you approved versus what was built
| Item | Approved at Gate 1 | Built | Deviation | Reason |
|---|---|---|---|---|

### QA and UAT summary
- Cases: passed / failed / not run
- Defects open by severity:
- Device and browser matrix actually executed:
- Not covered:
- UAT result and PM recommendation:

### Release plan
- Feature flag state and rollout percentage:
- Rollback steps and who decides:
- Who is on watch and for how long:
- When the success metric will be read:

## 5. Objections and risks raised during review (verbatim, not softened)
| Raised by | Issue | How it was resolved or why it remains |
|---|---|---|

## 6. Decisions already made on your behalf
| Decision | Made by | Why (two sentences) |
|---|---|---|

## 7. Assumptions and unverified claims
- ASSUMPTION:

## 8. Known issues and accepted risks (plain language)
-

## 9. Open questions for you
| Question | Why it matters | Options and the PM's recommendation |
|---|---|---|

## 10. Your options
- APPROVE
- APPROVE WITH CONDITIONS (tell us the conditions)
- REQUEST CHANGES (tell us what)
- REJECT (tell us why)

Reply in chat with your decision. The orchestrator records it.

---
PM notes (clearly labeled as the PM's own view, not from approved artifacts):
