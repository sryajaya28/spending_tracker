# Code map: feature -> file -> function

Source of truth for "where does X live". Read this first, then open only the file you need (COST_PLAN C2). Update it in the same PR when you move or add a function.
The app is classic scripts that share one global scope. Load order is the order of the `<script>` tags in `prototype/index.html` (and `SHELL` in `prototype/sw.js`); a file may use anything defined in an earlier file at once, and anything from a later file only inside functions that run later.
**Split status (C2): PR 5 done, three more to go (trades + recurring, events, auth + sample).** The head of the old `app.js` (to the end of the investment-dialogs section) is now in `prototype/app/`. The rest is still in `prototype/app.js`, listed by section marker (`grep -n "^/\* ----" prototype/app.js`); the next PRs move it out the same way, in order, and update this file.

## Already split: `prototype/app/` (load order)
| File | What it holds | Main names |
|---|---|---|
| `util.js` | DOM helpers, money and currency formatting, dates | `$`, `$$`, `esc`, `uid`, `RATES`, `money`, `moneyHtml`, `convert`, `toMinor`, `toMajor`, `compact`, `isoDate`, `monthKey` |
| `periods.js` | budget periods (calendar month or custom start day) | `periodStart`, `periodEnd`, `inPeriod`, `currentPeriod`, `periodKeyOf`, `periodName`, `lastMonths` |
| `icons.js` | SVG icon set | `ICON`, `icon` |
| `categories.js` | default categories and sub-categories | `CATS`, `SUBS`, `ensureDefaultCategories`, `subsOf` |
| `catalog.js` | price catalog, live prices, asset search | `CATALOG`, `priceSeries`, `assetInfo`, `getJSON`, `searchAssets`, `quote`, `refreshPrices` |
| `seed.js` | demo-data generator | `seed` |
| `state.js` | the one `state` object, saving | `state`, `sortTxns`, `save`, `loadPrices` |
| `selectors.js` | read helpers that mirror the SQL functions: balances, budgets, category tree | `D`, `cur`, `walletBalance`, `totalBalance`, `balanceAtEnd`, `spendTree`, `budgetStatus`, `catOf`, `walletOf`, `occasionStatus` |
| `portfolio-calc.js` | investments: holdings, average cost, profit and loss | `holdingsOf`, `holdingCost`, `pnlOf`, `portfolioUSD`, `pfMonths`, `PF_RANGES` |
| `loans-calc.js` | savings, loans, lent money, net worth | `loanBalance`, `loanCycle`, `loanRepaymentCategory`, `lentRepaymentCategory`, `toUSD`, `aiTag` |
| `ui-helpers.js` | toast, month picker, hash routing | `toast`, `tile`, `periodChoices`, `monthSelect`, `route`, `routeArg` |
| `charts.js` | hand-built SVG charts, plus the wallet and loan cards, asset and portfolio views, P&L section, debt plan maths and the loan payment dialogs that sat in that stretch | `flowChart`, `halfDonut`, `valueChart`, `holdingRow`, `walletCard`, `loanCard`, `viewAsset`, `viewPortfolio`, `viewPnlMonth`, `loanDialog`, `debtPlan`, `loanPaymentDialog`, `lentRepaymentDialog` |
| `views.js` | the screen functions (overview, transactions, budgets, settings, onboarding), the support dialog and the category spending trend | `sidebar`, `bottomNav`, `topbar`, `supportDialog`, `trendCard`, `trendDialog`, `viewOverview`, `viewDay`, `viewTransactions`, `viewBudgets`, `viewSettings`, `onboardingView`, `categoriesCard` |
| `landing.js` | signed-out landing, sign-in page, splash, add-to-home-screen hints and the web-to-app hand-off | `viewLanding`, `viewAuth`, `viewSplash`, `installBtn`, `installGuide`, `installDialog`, `handoffDialog`, `claimHandoff` |
| `household.js` | who may write, household settings (members, invites, role changes) and the `/join` page | `canWrite`, `viewNoAccess`, `householdCard`, `inviteDialog`, `memberDialog`, `viewJoin`, `joinBoot`, `hhRefresh` |
| `activity.js` | `render()`, the `VIEWS` table and the Activity screen | `render`, `VIEWS`, `viewActivity`, `actLoad` |
| `dialogs.js` | the shared dialog helpers and the category, icon and kind pickers | `dlg`, `open`, `close`, `lockScroll`, `catOptions`, `iconField`, `quickAddCategory`, `kindSeg` |
| `transfers.js` | transfers between wallets, the add/edit transaction, budget, occasion, category, breakdown, wallet and account dialogs, coin-account helpers | `transferDialog`, `saveTransfer`, `removeTransferGroup`, `recordCoinTxn`, `txnDialog`, `budgetDialog`, `occasionDialog`, `catDialog`, `breakdownDialog`, `walletDialog`, `accountDialog` |
| `invest-dialogs.js` | the investment dialogs: holding summary, buy/sell forms and their sync helpers | `holdingSummary`, `costRows`, `sellAssetDialog`, `holdingDialog`, `syncPickType`, `syncFeeBox`, `syncFund` |

## Still in `prototype/app.js` (section marker -> feature)
| Section marker | Feature |
|---|---|
| trades | the trade pop-ups and their forms |
| recurring | repeating expenses, income, transfers, buys |
| events | the delegated click/change/input/submit handlers (`data-act`, `data-form`) |
| auth + data loading | `onAuth`, loading and saving the user's data |
| sample data | demo mode, then the boot lines at the very end |

## Rules for edits
- `grep` the name across `prototype/` before adding a function, `data-act` or `data-form`: one global scope, collisions are silent.
- New top-level code that runs at load must come after everything it calls at load time (script order), same as before the split.
- Keep every file under 600 lines.
