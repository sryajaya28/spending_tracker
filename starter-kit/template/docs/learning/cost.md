# Learning: Sessions, context and cost

Part of `learning.md` (index). Lessons above the line were carried over from earlier projects (starter kit); add this project's own below it, and the dated story to the Session log in `learning.md`.

- **Cost = size of the conversation x number of calls.** In the first project 98.7% of all tokens were re-reads of earlier conversation; new output was 0.14%. One 640k-token session cost over $5 per message before any work. Short fresh sessions are the whole saving.
- **Role sessions (PM, Tech Lead, QA, Designer) that message each other multiply the cost** and add no quality over tests, a reviewer bot and one small fresh review. Nine such sessions cost $468 for four releases (about $48 a release). Do not rebuild that.
- Never wake an old big session (a cold cache re-reads everything at full price) and never switch model mid-session (caches are per model).
- Keep the start-up reading under 5k tokens: a short `CLAUDE.md`, everything else loaded only when the task touches it.
- Turn off connectors a coding session never needs; hundreds of tool names are re-announced on every reconnect.
- Replace waiting turns with one script that prints one line. Keep tool output terse (no pasted CI run lists or function source).
- Same-model reviewers share blind spots: use a different vendor's reviewer bot for Tier 2 and one fresh, small, diff-only session on a stronger model for Tier 3.
- Security review only for changes to authentication, access rules or the database; nothing else pays for it.
- Near the context budget: stop, write the task file, report. The rest runs in a new session.

---
