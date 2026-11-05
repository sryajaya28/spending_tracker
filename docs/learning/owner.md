# Learning: Working with the owner

Part of `learning.md` (index). Add a line here when a mistake in this area happens; add the dated story to the Session log in `learning.md`.

- **Follow the working agreement every time**: read `context.md` and this file first; after every change update `context.md`
  (section + dated changelog line), `regression_scenario.md` (scenario + automated-coverage map), README / `docs/NEXT_STEPS.md`
  when affected; add Indonesian strings to `prototype/i18n-id.js`; run the e2e suite; commit with the two trailer lines;
  push the session branch and `main`.
- Ambiguous requests ("native design", "the 2nd image part", "this part", "Details"): pick the most likely meaning, say which
  one you picked, and offer the alternative. Do not ask long questions for small things.
- The owner often sends several changes in a row: finish the current one, fold new ones in, and report all of them.
- Be honest and short in replies: what changed, what was verified, what was not, and what the owner must do (run SQL, approve).
- Remember explicit preferences: not sticky, no helper subtitles under titles, compact spacing, description next to the
  question, one filled button per dialog, no emojis-as-icons for actions, same colour for income and expense amounts,
  `Rp 1.234` formatting, "Account" not "Wallet", dark purple (not bright) in dark mode, never zoom the PWA.
- Never send secrets; never delete or overwrite data without looking at it first and, if in doubt, asking.
- After any restart or long gap `git fetch` and re-read `CLAUDE.md` and `docs/AGENTS.md`: rules and the Figma file changed mid-session. Design in Figma (the file named in CLAUDE.md) before any UI code, include dark and phone screens, and ask who the integrator is before merging into `staging`.

