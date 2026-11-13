# Designing in Figma (file "__PROJECT__")

File: __FIGMA_URL__ (key `DnfE4wtwMDGQyOW76MkVRW`). Pages: **Library** (tokens + components, build from these), **Features** (one section per request),
Mobile / Desktop / Components (older flat imports of the app: reference only, not components).

## What is in the Library page
- **Variables**, collection `__PROJECT__ tokens`, modes **Light** and **Dark** (same names as the CSS: `color/bg surface ink muted line soft brand brand-2 button tab on-fill accent warn good bad bad-soft hint shadow`,
  `radius/card field tab pill tile`, `space/xs sm md lg xl 2xl`). Every frame binds to them; **a dark frame is the same frame with the Dark mode set**, nothing is redrawn.
- **Text styles:** Title/22 Bold, Big number/26 Bold, Heading/16 Semi Bold, Body/15 Regular, Label/13 Medium, Note/12 Regular, Button/14 Semi Bold, Badge/11 Semi Bold, Tab/12 Bold, Hint/13 Regular, Row title/15 Semi Bold. **Effect style:** Shadow/card.
- **Components** (property names in brackets):

| Component | Properties |
|---|---|
| Button | `Kind` primary / secondary / danger, `Label` |
| Badge | `Text` |
| Corner tab (top-right of a card, e.g. "42 months left") | `Text` |
| Close | none |
| Field | `Type` input / select, `State` default / new (outlined = new or changing), `Label`, `Value` |
| Hint (yellow note) | `Text` |
| Recurring row | `Icon`, `Title`, `Amount`, `Where`, `When` (has a Manage button) |
| Avatar (who did it; shown only when a household has more than one person) | `Initial` |
| Chip (filter, e.g. by person) | `Text`, `Selected` |
| Icon (set of 24px line icons: categories, occasions, recurring, household, preferences, account, terms) | `Name` |
| Chevron (muted, 20px) | none |
| Settings row (icon, title, optional subtitle and value, chevron) | `Icon` (instance swap), `Title`, `Subtitle`, `Value`, `Show subtitle`, `Show value` |
| Settings tile (half-width card: icon box, title, subtitle) | `Icon` (instance swap), `Title`, `Subtitle` |
| Footer pill (small soft pill under a page) | `Text` |
| Switch | `State` on / off |

Figma instances cannot take new children, so **containers** (card, dialog, phone frame, rows) are built by the helper functions (`frame`, `card`, `phone`) with the same variable bindings.
A review frame per mode ("Library overview - Light / Dark") and an example ("Example - Edit debt, Every month") sit on the Library page.

## How to make a design (short scripts)
1. In one `use_figma` call paste `tools/figma/helpers.js` (about 3.9k characters; it also holds `featureSection`), then your frames. `tools/figma/example_edit_debt.js` is a complete example (light and dark from one loop).
2. `const sec = await featureSection('<short-name>', '<request in the owner\'s words>')` creates `Feature - <short-name>` with the note, `Status: design.` and an `Owner comments` layer. It switches to the Features page: call it once per script.
3. For each state: `phone(sec, '1 · <what> — Phone 390 · light', 'Light', x, y)`, build inside with `card`, `inst('Field', { Type, State, Label, Value }, parent, true)`, `inst('Button', { Kind, Label }, parent)` ...; repeat with `'Dark'` (same code in a loop).
4. One screenshot after composing (`await node.screenshot()`), then `tools/figma/lint.js` (read-only): every section needs the request note, a status line, phone light and dark frames and an `Owner comments` layer.
5. A design needs a new element? Add a component to the Library page (bound to the variables, text properties for its labels), then add it to the table above. Do not draw raw shapes in a feature section.

## Conventions
- Section `Feature - <short-name>` (same short name as the branch); frames `<n> · <what> — Phone 390 · light|dark`; note starts `Request (owner): ...`; status line `Status: design | approved | implemented | released.`
- Feedback: the owner writes it in the `Owner comments` layer or pastes it in the chat (agents cannot read Figma comments).
- Update the section to `implemented` when built; add as-built frames only where the build differs from the approved design.
- Size check (2026-11-04): the Edit debt frame in light and dark takes about 5.4k characters including the helpers, against about 9.5k before for one build of the same kind; more states or the dark version cost a few lines.

## Frame status suffix (Designer, 2026-11-05)
Every design frame or section name ends with one status suffix, kept current by the Designer: `[IN PROGRESS]` (being drawn), `[DONE]` (finished, waiting for the owner) or `[APPROVED]` (the owner approved it; only then may the Full-stack engineer build from it). Never build from a frame without `[APPROVED]` unless the fast lane applies (CLAUDE.md rule 6).

## Not done
The older flat sections on Mobile, Desktop and Components are not converted to components (kept as reference). Light and Dark modes were created without error, so the file's plan allows at least two modes (a plan limit on modes would have blocked the second one).
