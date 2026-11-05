# Learning: Editing code safely (app.js, shared scope, tracking)

Part of `learning.md` (index). Add a line here when a mistake in this area happens; add the dated story to the Session log in `learning.md`.

- **Everything lives in one global scope** (`app.js`). Name collisions are silent: a new `transferDialog()` replaced the real
  one, and a new form kind `'transfer'` hijacked the money-transfer submit handler (the same bug twice). `grep` for the name
  (function, `data-act`, `data-form`, element id) before using it.
- **Script edits**: use Python `str.replace` with an `assert s.count(old) == 1`, not `sed` with line numbers (lines shift after
  earlier edits) and never insert a `// comment` in the middle of a line (it swallowed the rest of the line and broke the file).
  Run `node --check` on every edited JS file straight away.
- Bulk rename scripts are dangerous: renaming "Wallet" to "Account" broke internal identifiers. Rename user-visible text only,
  keep internal names, and review the diff.
- When a helper already returns a signed/formatted string, do not add another sign (`−−Rp49.000`, `++$5,584`). Read what the
  helper returns first.
- Re-rendering replaces DOM: a focused input that is removed fires a `change` event with its old value and can restore old
  state (old search text came back). Handle text inputs on `input`, selects on `change`.
- A modal's `close()` does not empty it: the form is still in the DOM. Check `#dlg[open]`, not the form's existence.
- Do not call `render()` and then rely on state that an event can still overwrite; set state first, render last.
- Deleting/editing something that other rows point at (loan charge ↔ expense, recurring first entry ↔ rule) must update both.
  A first payment entered by hand and then moved by editing the rule left a stale duplicate (`spec.first_tx`, `first_made`).
- Sample data: keep every transaction categorized, no negative account, every investment holding with an average price; the
  e2e `samplelocal` test checks it. Currency profiles must work for unknown currencies (fallback to USD).
- A filtered view must not invent its own sign or total convention: the loan view showed `+` for charges and summed differently, and a test had even asserted it. Change the test that encoded the old rule and add a sum check (day total = signed rows).
- Hidden form fields still submit, and `display:none` fields cannot be `fill`ed by tests: decide what a hidden value means before saving (a hidden weekly amount became the monthly payment). `addRule` with a future start marks the first payment as already booked (`first_made`): push the rule directly when it is not.
- `const state` in a classic script is not on `window`: other files must test `typeof state !== 'undefined'`.

