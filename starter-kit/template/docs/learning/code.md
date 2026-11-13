# Learning: Editing code safely

Part of `learning.md` (index). Lessons above the line were carried over from earlier projects (starter kit); add this project's own below it, and the dated story to the Session log in `learning.md`.

- **Keep source files under about 600 lines and lines under 160 characters, with a feature -> file map (`docs/MAP.md`).** One 390 KB file cost about 100k tokens per read and made every change Tier 2. Split early; a split is mechanical when a script proves "new files + remainder == old text" byte for byte and the whole test suite passes before and after.
- **Shared global scope hides name collisions**: a new function replaced a real one of the same name, twice. Grep for the name (function, element id, tracking name, form kind) before using it. Prefer modules.
- **Script edits**: use `str.replace` with an `assert s.count(old) == 1`, not `sed` with line numbers (lines shift), and never insert a `// comment` mid-line. Run a syntax check (`node --check`) on every edited file straight away.
- Bulk renames are dangerous: rename user-visible text only, keep internal identifiers, review the diff.
- When a helper already returns a signed or formatted string, do not add another sign. Read what the helper returns first.
- A filtered view must not invent its own sign or total convention; add a sum check (total = signed rows) to its test.
- Re-rendering replaces DOM: a removed focused input fires `change` with its old value. Handle text on `input`, selects on `change`. Set state first, render last.
- Deleting or editing something other rows point at must update both sides.
- Hidden form fields still submit: decide what a hidden value means before saving.
- Sample and demo data must satisfy the same rules as real data (a test checks it); helpers must work for unknown currencies and locales (fall back, never crash).
- Add lint and a type check (`tsc --checkJs` with JSDoc needs no build step) to CI from day one: the machine finds the class of bug that otherwise costs a review pass.
- Add error monitoring before real users arrive; without it nobody knows production is broken.
- A branch cut before a big refactor cannot be rebased onto it: cherry-pick, take the new files, and re-apply the old diff hunk by hunk where each hunk's old text matches exactly one place.

---
