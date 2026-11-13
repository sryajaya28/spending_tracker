# Learning: Working with the owner

Part of `learning.md` (index). Lessons above the line were carried over from earlier projects (starter kit); add this project's own below it, and the dated story to the Session log in `learning.md`.

- **Restate, then ask once.** Turn the request into 2 to 5 done-when checks. Put every open question in ONE message, each with a recommended default. Do not ask long questions for small things.
- Ambiguous requests ("this part", "the 2nd image", "native design"): pick the most likely meaning, say which one you picked, and offer the alternative.
- The owner often sends several changes in a row: finish the current one, fold the new ones in, and report all of them.
- Be honest and short in replies: what changed, what was verified, what was not, and what the owner must do (run SQL, approve, click).
- "Approved" means plain words ("approved", "release"). Silence, a thumbs-up on a screenshot or a question is not approval. Approval of a design is not approval to release.
- Write explicit preferences down in `context.md` section 2 the first time they are said, so the owner never repeats one. Preferences seen so far: compact spacing, no helper subtitles under titles, one filled button per dialog, no emojis as action icons, the app's own components instead of OS pickers, a dark (not bright) accent in dark mode.
- Never send secrets; never delete or overwrite data without looking at it first and, if in doubt, asking.
- When a plan item completes, grep the docs for its old "not built yet" wording in the same PR; stale status lines make the owner ask.
- Before redrawing or rebuilding an existing screen, read its markup and list every element; working from memory dropped two elements and the owner had to point them out.
- After any restart or long gap, `git fetch` and re-read `CLAUDE.md`: rules change between sessions.

---
