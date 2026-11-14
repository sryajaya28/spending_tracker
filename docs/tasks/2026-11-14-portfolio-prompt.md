# Start prompt for the next session (copy as the first message)

Continue the Stiver redesign, design phase, in Figma. Branch claude/relaxed-tesla-nim74n (check it out first: `git fetch origin claude/relaxed-tesla-nim74n && git checkout claude/relaxed-tesla-nim74n`; commit and push there, no PR, no subagents, no other sessions).

Read only: CLAUDE.md, docs/tasks/2026-11-14-portfolio-design.md (start here) and docs/tasks/2026-11-14-design-handover.md. No context.md / learning.md rows unless a code check needs them. Day page is PARKED: leave frames 215-* and [PARKED] frames alone.

First: Figma whoami, then create_session on file DnfE4wtwMDGQyOW76MkVRW (section 116:1376). `figma-use` is not a Skill here: read skill://figma/figma-use/SKILL.md with ReadMcpResourceTool (server "Figma") and pass skillNames "resource:figma-use" to every use_figma call. Screenshots inside use_figma with node.screenshot(); copy the saved PNG path from the tool result into the scratchpad directory and send with SendUserFile.

Restate the job as 2 to 5 done-when checks; ask all open questions in ONE message with recommended defaults; proceed on defaults if I answer "Default".

Job: (d) Portfolio + asset page (frames 140/142, 144/145 portfolio; 141/143, 146/147 asset), then the Debt, Investment, Lent tabs and the P&L month view (not drawn). One small job, stop at ~100k tokens.
1. List EVERY control and card from the code (viewPortfolio, asset page, tabs, helpers), incl. states (household, empty, sample data); grep the data-act that reaches each one.
2. Compare phone AND desktop frames AND the old app (116-1381/1831); fix both directions. Charts stay grey boxes labelled with what they show (list them in the report).
3. Owner rules (hand-over section 2): Inter, brand #4a44c6, dark ground #0e0d1f / card #1d1c36 / tile #2d2c4f / muted #a9a8c6, light ground #f3f3f9 / card #fff / tile #eef0fb / ink #1b1a4b / muted #5d6183, card radius 24, 44px taps, controls named "ctl: <label>", 5-slot nav with icon-only centre Add.
4. Measure each frame (overflow, text inside parent, contrast 4.5:1, controls < 44px, no TEMP) and LOOK at it in both themes. Never claim a check you did not run; show a real final screenshot before asking for approval.
Traps: createAutoLayout frames get a WHITE fill; cloned frames keep minHeight (null it before resize); phone nav is ABSOLUTE at a fixed y (move it with the height: y = height - 20 - 68, frame bottom padding 104); ABSOLUTE only in auto-layout parents; #8887a8 fails 4.5:1 on tile (use muted); cloning desktop rows into phone: bar inner fill keeps old px width (set pct * track), stack name+badge above amount; check phone against desktop, not only the code; remove TEMP nodes.
At the end: update 2026-11-13-redesign.md NEXT line, tick (d) in the hand-over with frame ids, Session log line in learning.md, commit, push, report (done / not done / open questions). Next after this: (e) Settings 133/135, 148/149. Do not start docs/design-handover/.
