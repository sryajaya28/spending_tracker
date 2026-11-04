# Stiver design files

Figma-importable design of every screen, dialog and component of the app, plus the design tokens. This folder is
**generated from the running app** by `tools/design/export.js`, so it always matches what is shipped. It is the starting
point for a Figma design system: import it, turn the components into Figma components, and the tokens into variables.

## What is here

| Folder | Contents |
|---|---|
| `tokens/stiver.tokens.json` | Design tokens in the W3C design-token format: colours (light and dark themes with the same names, category and asset colours), font family and weights, type scale, radius, spacing, sizes, shadows. |
| `components/<group>/` | One file per component, light and `-dark` versions: **buttons**, **text** (type scale, badges), **banners**, **graphs**, **popups** (dialog, toast, tooltip), **form-fields**, **date-picker**, **dropdown**, **filters**, **navigation**, **cards**, **rows**. |
| `screens/mobile-light/`, `screens/mobile-dark/` | Every page (full height, 390 px wide) and every dialog (the dialog card itself). |
| `screens/desktop-light/`, `screens/desktop-dark/` | The main pages at 1280 px wide (light and dark). |

Each design comes as **`.svg`** (import this into Figma: real text layers and vector shapes) and **`.png`** (a quick
preview; for dialogs the PNG shows the dialog on its page).

Components: buttons (primary, secondary, danger, chip, dialog actions, hero actions, icon button, text links, install
call to action, see upcoming) · text (type scale, badges) · banners (sample data, sample-data promo, hint) · graphs (money-flow line,
spending donut, category trend bars, portfolio value, progress bar) · popups (dialog, toast, tooltip) · form fields (text,
amount, select, date, segmented control, switch, image attach, message with counter) · date picker (calendar) · dropdown
(closed, grouped list, list with search) · filters (filter bar, active filter bar, pill, active pill, reset filters, search
and period) · navigation (top bar, bottom nav, desktop sidebar, tabs) · cards (hero, card, loan card) · rows (transaction,
day, holding, budget).

Screens: landing, sign-in, sign-up, overview, transactions (collapsed, expanded, filtered, loan account, with upcoming), budgets,
portfolio (savings, investment, lent, loan), asset history, settings, and the dialogs: add expense / income, edit
transaction, transfer, invest, add asset, add cash, asset, buy, average price, budget, occasion, account, category, loan
payment, lent history, recurring manage, upcoming transactions, support, install (iPhone), trend detail, spending breakdown.

## Importing into Figma

1. **Screens and components**: drag the `.svg` files onto the Figma canvas (or File > Import, or copy the SVG text and
   paste). Each file becomes a frame with editable text and shapes. Text uses **Inter**, which Figma has built in.
2. **Make components**: select an imported component frame and press *Create component* (Ctrl/Cmd + Alt + K). Put the
   light and `-dark` files side by side as variants (property `Theme`).
3. **Tokens**: install the **Tokens Studio for Figma** plugin, *Load from file* (or sync with this GitHub repository at
   `design/tokens/stiver.tokens.json`), then *Export to Figma* to create **variables** (colour modes Light and Dark) and
   **text styles**. Any importer that reads the W3C design-token format works too.
4. Replace the raw colours in imported frames with the variables as you build the system.

Notes: the SVGs are faithful to the app but are a starting point, not hand-built Figma files: auto layout, constraints
and component properties must be added in Figma. Emoji category icons come in as text. Native browser parts (the
calendar icon inside date fields, select arrows) are drawn as simple text glyphs.

## Keeping it in sync

After a UI change, regenerate and commit this folder (the dev server must be running):

```bash
python3 tools/dev_server.py 5180 &
```

```bash
node tools/design/export.js
```

`node tools/design/export.js overview` regenerates only the files whose name contains "overview". `DESIGN_MODE=desktop-dark node tools/design/export.js` regenerates only one screen set (`mobile-light`, `mobile-dark`, `desktop-light`, `desktop-dark`) and skips the components. To add a screen or
component, add a line to `SCREENS` or `COMPONENTS` in `tools/design/export.js`. The exporter uses the app with the e2e fake
backend and the built-in sample data (nothing touches real data) and `tools/design/vendor/dom-to-svg.js` (MIT).
