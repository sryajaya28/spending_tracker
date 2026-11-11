# Code map: feature -> file -> function

Source of truth for "where does X live". Read this first, then open only the file you need (COST_PLAN C2). Update it in the same PR when you move or add a function.
The app is classic scripts that share one global scope. Load order is the order of the `<script>` tags in `prototype/index.html` (and `SHELL` in `prototype/sw.js`); a file may use anything defined in an earlier file at once, and anything from a later file only inside functions that run later.
**Split status (C2): done (PR 8).** Everything except the boot lines is now in `prototype/app/`; `prototype/app.js` is the 17-line boot (language and theme, cloud init, handoff and join, live rates, service worker) and loads last.

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
| `loans-calc.js` | savings, loans, lent money, net worth | `loanBalance`, `loanCycle`, `loanRepaymentCategory`, `lentRepaymentCategory`, `lentCategory`, `lentOfTxn`, `toUSD`, `aiTag` |
| `ui-helpers.js` | toast, month picker, hash routing | `toast`, `tile`, `periodChoices`, `monthSelect`, `route`, `routeArg` |
| `charts.js` | hand-built SVG charts, plus the wallet and loan cards, asset and portfolio views, P&L section, debt plan maths and the loan payment dialogs that sat in that stretch | `flowChart`, `halfDonut`, `valueChart`, `holdingRow`, `walletCard`, `loanCard`, `viewAsset`, `viewPortfolio`, `viewPnlMonth`, `loanDialog`, `debtPlan`, `loanPaymentDialog`, `lentRepaymentDialog`, `lentDialog`, `lentCheck`, `lentOriginDialog` |
| `views.js` | the screen functions (overview, transactions, budgets, settings, onboarding), the support dialog and the category spending trend | `sidebar`, `bottomNav`, `topbar`, `supportDialog`, `trendCard`, `trendDialog`, `viewOverview`, `viewDay`, `viewTransactions`, `viewBudgets`, `viewSettings`, `onboardingView`, `categoriesCard` |
| `landing.js` | signed-out landing, sign-in page, splash, add-to-home-screen hints and the web-to-app hand-off | `viewLanding`, `viewAuth`, `viewSplash`, `installBtn`, `installGuide`, `installDialog`, `handoffDialog`, `claimHandoff` |
| `household.js` | who may write, household settings (members, invites, role changes) and the `/join` page | `canWrite`, `viewNoAccess`, `householdCard`, `inviteDialog`, `memberDialog`, `viewJoin`, `joinBoot`, `hhRefresh` |
| `activity.js` | `render()`, the `VIEWS` table and the Activity screen | `render`, `VIEWS`, `viewActivity`, `actLoad` |
| `dialogs.js` | the shared dialog helpers and the category, icon and kind pickers | `dlg`, `open`, `close`, `lockScroll`, `catOptions`, `iconField`, `quickAddCategory`, `kindSeg` |
| `transfers.js` | transfers between wallets, the add/edit transaction, budget, occasion, category, breakdown, wallet and account dialogs, coin-account helpers | `transferDialog`, `saveTransfer`, `removeTransferGroup`, `recordCoinTxn`, `txnDialog`, `budgetDialog`, `occasionDialog`, `catDialog`, `breakdownDialog`, `walletDialog`, `accountDialog` |
| `invest-dialogs.js` | the investment dialogs: holding summary, buy/sell forms and their sync helpers | `holdingSummary`, `costRows`, `sellAssetDialog`, `holdingDialog`, `syncPickType`, `syncFeeBox`, `syncFund` |
| `trades.js` | buying and selling investments, trade records, fees and the trade pop-ups | `recordTrade`, `removeTrade`, `tradeList`, `tradeDialog`, `costDialog`, `cashDialog`, `convertCashTrades`, `backfillSaleRecords` |
| `recurring.js` | recurring rules (weekly or monthly expense, income, transfer or buy) and the catch-up that creates due entries | `addRule`, `generateRecurring`, `runRecurring`, `ruleDialog`, `recurringCard`, `nextAfter` |
| `events-input.js` | the delegated click (`data-act`), keydown, input and change handlers, asset search and pick, Settings controls | `runAssetSearch`, `pickAsset`, `applySetting` |
| `events-submit.js` | the delegated submit handler for every `data-form`, scroll memory, hash-change and unsaved-changes handlers | `scrollPos`, `forgetScroll` |
| `auth.js` | sign-in and sign-up, email-confirmation polling, `onAuth`, loading the user's data, the save-error handler | `submitAuth`, `onAuth`, `loadUserData`, `onSaveError`, `resetSessionView`, `startPolling` |
| `demo-mode.js` | sample (demo) mode, kept apart from saved data | `DEMO_KEY`, `demoWanted`, `setDemo`, `demoBar`, `removeSample` |

## Still in `prototype/app.js`
Only the boot lines (17 lines), which must run last: they call code from every file above.

## Rules for edits
- `grep` the name across `prototype/` before adding a function, `data-act` or `data-form`: one global scope, collisions are silent.
- New top-level code that runs at load must come after everything it calls at load time (script order), same as before the split.
- Keep every file under 600 lines.
