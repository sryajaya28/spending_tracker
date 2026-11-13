# Analytics: event tracking guide

Every new page, button, feature or interaction ships **with its event tracking**, in the same change, and a test covers it.

## Checklist for every new page / button / feature
1. Every button gets a unique, descriptive tracking name (for example a `data-act="snake_case_name"` attribute read by one click handler).
2. Every form or pop-up gets a name (`data-form`), so opening it is tracked.
3. Every business outcome (created, changed, deleted, recorded) fires a **named event** right before or after it succeeds.
4. **Nothing private is sent**: no amounts, names, emails, notes or ids of user content. Property values are categories and counts.
5. The test suite asserts the event (name and properties) and that nothing private is in it.
6. Add the event to the catalog below.
7. Prove it once on staging after any hosting or proxy change: confirm the event arrives at its destination.

## Event catalog
| Event | When | Properties |
|---|---|---|
