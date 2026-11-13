# Request template (optional, 2 minutes, saves a round trip)

Paste this into a request and fill what applies. Short answers are fine; "no preference, you choose" is a valid answer.

```
What:            one sentence, in your words
Where:           screen / pop-up / function (for example "Add expense pop-up", Settings > Categories)
Done when:       2-4 checks you will do yourself ("button only shows when something is archived", "works in dark mode and on a phone")
Never / always:  rules and edge cases ("never auto-select anything", "keep the last choice", "empty state says ...")
Lane:            hotfix | feature (Figma first) | docs only
Not included:    what you do NOT want touched
```

How the assistant uses it: it restates "Done when" as the acceptance checks, asks **one batched question** for anything undecided (with a
recommended default), writes the feature test entry first, builds, and reports with `docs/READY_REPORT.md`.
