# Stiver: regression test scenarios

Manual regression checklist for https://stiver.io, with the automated coverage noted per area. Run it before a release or
after a risky change. **Keep it current:** whenever a feature is added or changed, add or edit the matching scenarios in
the same commit (see `context.md` section 0).

## How to use this file

- **Devices:** a phone (390 px wide, ideally the installed home-screen app on iPhone) and a desktop browser (1280 px).
  Where a scenario says "phone" or "desktop" it only applies there. Also spot-check 360 px.
- **Data:** use your own test account, or turn on **Settings > Account > Use sample data** (demo mode, nothing is saved).
  Real data is needed for anything about saving, syncing or reloading.
- **Format:** `ID` · precondition · steps · expected result. "Reload" means close the app fully and reopen it.
- **Automated tests:** `bash tests/e2e/run_all.sh` (all) or `bash tests/e2e/run_all.sh <name>` (one); the Python check is
  `python3 tests/test_yahoo.py`. The coverage map at the bottom says which test guards which area. A passing suite does
  not replace the manual checks marked **(manual)**: real sign-in, real email, real prices and the installed app cannot
  be tested from the sandbox.

---

## 1. Sign-up, sign-in and account

| ID | Scenario | Expected |
|---|---|---|
| AUTH-01 | Visit the site signed out | Landing page: header with clear space above it on phones (not touching the status bar), a text-only hero (headline, sub-line, **Get started** and an outlined **Sign in** button; no product mock-up card), demo video, features, how it works, final CTA, footer with Privacy and Terms. The demo video shows the current app (Overview with hover on the donut, add an expense with the category search, a day's transactions, Budgets, Portfolio with a time frame, a transfer) **(manual)**. No "Private by design" block, no "Sign up with email or Google" note. |
| AUTH-02 | Sign up with email + password (min length per Supabase) | "Check your email" screen. A confirmation email arrives from the custom sender **(manual)**. |
| AUTH-03 | Open the confirmation link on a phone while the desktop shows "Check your email" | The desktop signs in on its own within about 15 s or when the tab is focused; the link returns to https://stiver.io, not a `*.vercel.app` address **(manual)**. |
| AUTH-04 | Press "I've confirmed my email" | Signs in if confirmed; otherwise a clear message, no crash. |
| AUTH-05 | Sign in with a wrong password | "Wrong email or password." |
| AUTH-06 | Sign in with Google **(manual)** | Lands signed in on Overview with a seeded Cash wallet and default categories for a new user. |
| AUTH-07 | Forgot password, then follow the link | Reset form; new password works; link returns to stiver.io **(manual)**. |
| AUTH-08 | Settings > Account: Sign out | Back to landing; data not visible. |
| AUTH-09 | Settings > Account: Sign out others | Other devices are signed out on their next request. |
| AUTH-10 | A new user | Gets a profile (name, currency IDR), a Cash wallet, 12 categories with 11 sub-categories. Nothing else. |
| AUTH-11 | Two accounts | Account B never sees account A's data (RLS). Query another user's rows with the user's token: empty **(manual / SQL)**. |

Automated: `run`, `sample`, `confirm`, `csp`, `landshot`.

## 2. Look, language, install, layout (cross-cutting)

| ID | Scenario | Expected |
|---|---|---|
| UI-01 | Settings > Profile > Language: Bahasa Indonesia | Menus, buttons, dialogs, toasts and empty states switch language; money and dates use Indonesian format; choice survives reload and is saved to the profile. |
| UI-02 | Settings > Profile > Appearance: Light / Dark / Match device | Whole app (cards, charts, donut, dialogs, landing) switches without unreadable text; saved to the profile and remembered on the device. |
| UI-03 | Phone: open every page (Overview, Activity, Budgets, Portfolio and its tabs, Settings, landing, sign-in, an open dialog) | No horizontal scroll or sideways panning; nothing is cut off at the right edge. |
| UI-04b | Phone browser: pull down at the top of a page | The browser's normal pull-to-refresh is left **enabled** in browsers (it is disabled only in the installed home-screen app); scrolling back up to the top works **(manual)**. |
| UI-04 | Phone: double-tap and pinch | The page does not zoom; tapping a text field does not zoom. |
| UI-05 | Phone, installed from Safari "Add to Home Screen" **(manual)** | Opens full screen with no browser bars; icon is the Stiver logo; status bar visible; no pull-down bounce. A link opened inside another app still shows that app's bar (expected). |
| UI-06 | Phone bottom bar | Overview, Activity, raised **Add**, Budgets, Portfolio. "Add" label is level with the other labels (same baseline, checked by `noscroll`). No floating + button. Settings is reached from the round profile icon top right. The labels sit close to the bottom edge (no big empty band under them, also on iPhones with a home indicator **(manual)**), and the last item of every page can scroll fully above the bar. |
| UI-07 | Desktop | Left sidebar with Overview, Transactions, Budgets, Portfolio, Settings; top-right name pill opens Settings. No bottom bar. |
| UI-08 | Open any add/edit dialog | The phone keyboard does **not** open until a field is tapped. |
| UI-13 | Move between pages (tab bar, sidebar, opening a day, Back) after scrolling down | The new page always opens **at the top**; the previous page's scroll position is not kept. |
| UI-09 | Pages have no helper subtitles under titles | Titles stand alone; spacing is compact. On a phone the title and the profile icon sit a little below the status bar (not touching it), in the installed app too **(manual)**. |
| UI-11 | Open any dropdown (account, category, month, language, currency, filters, asset type, repeat...) on phone and desktop | The list opens as an **app-styled popover** (rounded, themed, current choice ticked, group headings for optgroups), not the OS picker. It stays on screen (flips upward near the bottom), works inside dialogs, in light and dark. Tap an option: the field updates and the app reacts (e.g. the amount unit follows the account). Tapping outside or Esc closes it (Esc does not close the dialog); Arrow keys, Enter, Home/End and typing jump work; tapping the field again closes it. |
| UI-12 | Loading screens (opening the app, signing in, loading your data; throttle the network to see them **(manual)**) | The Stiver logo floats with a pulsing ring and an orbiting yellow coin, a short bar runs under it, and the line under the name changes every ~2.4 s ("Waking up Stiver…" / "Fetching your finances…", "Counting your coins…", "Lining up your budgets…", "Almost there…"). Works in light and dark and in Bahasa Indonesia; with reduced-motion enabled nothing animates and only the first line shows. |
| UI-10 | A very long name (account, category, note) | Wraps or truncates without breaking the layout. |

Automated: `noscroll`, `langsave`, `darkshots`, `idcrawl`, `ios`, `csp`.

## 3. Overview

| ID | Scenario | Expected |
|---|---|---|
| OV-01 | Hero card | **Total Balance = savings accounts + investments** (money lent and loans are **not** included; Portfolio > Net worth covers them), so with no investments it equals Portfolio > Savings. A small **(i)** next to "Total Balance" shows "Savings + investments" (tap/hover; light icon on the blue card). Shows the period's change in amount and as a **% of the balance it started with** (e.g. `−0.8%` next to `−IDR 680,886 this month`; both always have the same sign; `—` when the starting balance is zero or negative). No "N accounts" label. No chart. Four buttons Expense / Income / Invest / Transfer on **one row**; each opens the right dialog. |
| OV-01b | Sample-data offer on an empty account | When the total balance is **under 1 USD** (a new or empty account) and sample mode is off, the **yellow banner** (same look as the sample-mode banner) "Just looking around? · Test Stiver now with sample data" (description next to the question) and a short **Try** button (not a toggle) appears at the very top of Overview. Tapping the button shows the demo account and the sample banner (the card disappears; "Back to my data" restores the own data and the card). With a real balance of 1 USD or more the card is not shown. Settings > Account > Use sample data still works. |
| OV-02 | Desktop layout | Hero spans the full width; below it a two-column grid: Money Flow and Spending, then Budgets and Recent transactions side by side with no empty cell. Phone: single column. |
| OV-03 | Money Flow | Six periods of income and spending; hover/tap a point shows net for that period. Saved shows income minus spending of the selected period. |
| OV-04 | Spending donut | Top 5 categories + Others. Hover (desktop) or tap (phone) an arc: centre shows name, amount and % of total; tap the same arc or elsewhere to clear. Empty month: grey ring and zero total. No category buttons under it. **Details** opens the breakdown with expandable sub-categories. |
| OV-05 | Budgets card | Shows **only the overall budget** ("All spending": spent / budget · %, empty bar at 0%): no category budgets and no special occasions on Overview. The button says **Details**; tapping the button or anywhere on the card (except the month picker) opens the Budgets page. The period dropdown on the card also changes the Spending card (shared period). Without an overall budget it says "No monthly budget". |
| OV-06 | Recent transactions | Latest rows, "View all" goes to Activity. Each row: title and amount on the **same line**, `Category · Account` below the title and the **date below the amount** (right aligned); there is **no "Uncategorized" tag** (an uncategorized row just says "No category"); for a sub-category only the sub-category name is shown ("Public transit", not "Transport › Public transit"). |
| OV-07 | Add/Edit through any entry point | After saving, numbers on the page refresh immediately. |

Automated: `donut`, `ovocc`, `budgetbar`, `run`.

## 4. Transactions (Activity)

| ID | Scenario | Expected |
|---|---|---|
| TX-01 | Open Activity | Line 1: the search box on the **left** (placeholder "Search") and the period dropdown on the **right**; **no `+ Add` button on phones** (the bottom bar Add does it), it stays at the end of line 1 on desktop. Line 2: the three filters keep their full labels **All categories / All occasions (only when occasions exist) / All accounts**, sized in proportion so none is cut off at 360-390 px. |
| TX-02 | Daily list | One row per day, newest first: day number and month, the weekday with the **transaction count underneath** (nothing else), and the day's net amount on the right (green/red). Transfers count in the number but not in the net. |
| TX-03 | Tap a day | Opens `#/transactions/YYYY-MM-DD`: that day's transactions, Back link with clear space between it and the date, a **Search** box under the header (filters that day's rows by note or category; "No transactions match." when none; cleared when you open another day), `+ Add` prefilled with that date. Edit/delete works; Back returns to the list. |
| TX-04 | Search, category, account filters | List narrows; they combine; "Uncategorized" works; the account filter can pick a USDT/USDC holding. |
| TX-05 | Add an expense: Account first, then amount | Amount label follows the account's currency (IDR, USD, USDT...). Date defaults to today. Repeat field present. Saved row appears under its day. |
| TX-06 | Add income / expense with no category | AI-style auto-tag if history matches (badge AI), otherwise "Uncategorized". With a category chosen: no AI badge. |
| TX-07 | Add a new category or sub-category from the form | There is **no separate button**: **＋ Add new category** is the last entry of the Category dropdown (after a divider, in brand colour). Choosing it opens the small form below the field **without opening the keyboard** (type only after tapping Name); the dropdown keeps its previous choice. Choosing any existing category hides the form again. Adding creates it inline and selects it; Enter in the name field adds it and does not submit the transaction. |
| TX-07b | Category dropdown search | The list has a **Search** box on top (not focused automatically); typing filters categories and sub-categories, searching a parent name also lists its sub-categories, "Add new category" is a **fixed footer of the list** (the Search box is fixed on top, only the categories in between scroll; the add entry is visible and tappable without scrolling, also in a phone browser with its toolbars) **(manual, real phone)**; when nothing matches, a muted **Category not found** line appears directly above the add button (and disappears when something matches). Also available in the Activity category filter and the budget category picker. **(iPhone)** Tapping the Search box keeps the list open: the keyboard opens and the list shrinks to fit above it **(manual)**. |
| TX-07c | iPhone: tap a dropdown, choose an option | Exactly one app-styled list opens; after choosing, **no second (iOS native) list opens** and the field is not left focused (regression: focusing the select after a tap made iOS reopen its own picker). Also check one tap is enough after a keyboard was open **(manual, real iPhone)**. |
| TX-08 | Add expense with a special occasion | Occasion preselected when the date is inside its range; picking a date outside leaves the choice alone. Row shows the occasion badge. |
| TX-09 | Edit amount / date / note / category | Saved; balances and reports update. |
| TX-10 | Delete a transaction | Removed; balances restored. |
| TX-11 | Amount 0, negative or empty | Rejected with a message; nothing saved. |
| TX-12 | Date in the future | Row shows an **Upcoming** badge to the left of the date (right column, rows stay two lines); it changes no balance, holding, net worth or monthly total until that day (see section 12). |
| TX-13 | Transfer rows in the list | Show the Transfer badge; tapping opens the transfer detail, not the edit form. A transfer fee row shows the fee badge. |

Automated: `daily`, `run`, `quickcat`, `occtx`, `transfer`.

## 5. Transfers between accounts

| ID | Scenario | Expected |
|---|---|---|
| TR-01 | Transfer between two accounts of the same currency | Source decreases, destination increases by the same amount; not counted as income or spending. |
| TR-02 | Cross-currency transfer | Requires "Amount received"; both balances move in their own currencies. |
| TR-03 | Optional fee | Fee is taken from the source on top of the amount and **is** spending (fee badge). |
| TR-04 | Same account on both sides, or not enough balance | Blocked with a message (cards may overdraw). |
| TR-05 | Open a transfer, press Delete transfer | Both legs and the fee are removed; both balances return. |
| TR-06 | Only one account exists | Message to add a second account first. |

Automated: `transfer`.

## 6. Recurring entries

| ID | Scenario | Expected |
|---|---|---|
| RC-01 | Add an expense, income, transfer or investment buy with Repeat = Every week / Every month | The first entry is saved as normal; Settings > Recurring lists the rule with its next date. |
| RC-02 | Start date three weeks ago, weekly | On saving/next open the missing weekly entries appear on their correct dates, no duplicates; reopening adds nothing more. |
| RC-03 | Monthly on the 31st | Short months use their last day (28/29/30); other months use the 31st. |
| RC-04 | Pause then Resume | Paused: nothing is created. Resume skips what was missed while paused. |
| RC-05 | Delete a rule | Rule gone; past entries stay. |
| RC-06 | Open the app on two devices | Entries are not doubled (ids derive from rule + date). |
| RC-07 | Recurring in USDT/USDC | Created from the coin; skipped if the coin balance is too low. |
| RC-08 | Entries appear only when the app is opened or refocused | Documented limitation (no server job). |

Automated: `recurring`.

## 7. USDT / USDC as an account (income and expenses)

| ID | Scenario | Expected |
|---|---|---|
| CN-01 | Add income, Account = "Binance (USDT)" (same `Name (CUR)` pattern as savings accounts, under the group heading **Investment Account**) | Amount is entered in USDT; the holding rises; the transaction shows in USD (1 USDT = 1 USD), counts as income and in Money Flow; no fiat account changes. |
| CN-02 | Add income with no USDT yet | The Account list offers "<investment account> (USDT)" / "(USDC)" under **Investment Account** (income only); saving creates the holding (and a "Crypto" investment account if none). |
| CN-03 | Expense paid from USDT | Holding decreases; counts as spending, budgets and categories. More than you hold: refused. |
| CN-04 | Expense type | The "new USDT" choices disappear; only held coins are listed. |
| CN-05 | Edit the amount | The holding changes by the difference. |
| CN-06 | Delete | The coins come back / go away; blocked if the income was already spent. |
| CN-07 | Income dated in the future | Holding, net worth and balances do not change until the date; the coins are not spendable before then. |
| CN-08 | Reload / second device | Same balances; transactions list shows "account (USDT)". |

Automated: `coin`.

## 8. Budgets

| ID | Scenario | Expected |
|---|---|---|
| BU-01 | Add an overall budget | Overview and Budgets show spent / budget, %; empty bar at 0%. Footer shows the status badge and **Edit** on one centred line. |
| BU-02 | Add a category budget | Appears under By category; sub-category spending rolls into its parent. |
| BU-03 | Change a budget amount | Applies from the selected period onward; earlier periods keep the old amount. Editing an existing category + period updates in place (no duplicate). |
| BU-04 | Overspend | Status turns to Almost there (80%+) then Over budget; counts update. |
| BU-05 | Special occasion budget | Create with a name, amount, optional dates; "+ Expense" opens the form preselected; "Expenses" lists its transactions; the row shows only the date range. |
| BU-06 | Occasions per period | An occasion shows only in the period(s) its dates cover (or that contain its tagged expenses); undated ones show always. |
| BU-07 | Occasion spending | Occasion expenses still count in the monthly budgets; future-dated ones do not count yet. |
| BU-08 | Archive / delete an occasion | Archived: moves to the archive; delete removes it and untags its expenses. |
| BU-09 | Period dropdown | Shows the custom period when a start day is set. |

Automated: `run`, `budgetbar`, `occtx`, `ovocc`.

## 9. Portfolio

### 9.1 Net worth, breakdown, lists

| ID | Scenario | Expected |
|---|---|---|
| PF-01 | Net worth card | Title "Net worth" alone (no "after loans" label). Small currency dropdown top right (IDR, USD, EUR, GBP, SGD, AUD, JPY); changing it converts Portfolio numbers, budgets and totals. No exchange-rate sentence. Card is compact. |
| PF-02 | Net worth maths | Savings + Investments + Lent - Loans. With no investments, Net worth = savings (+ lent - loans). |
| PF-03 | Breakdown | No bar. Savings / Investments / Lent show shares that add to 100% of assets; **Less: Loans** sits apart with the minus amount and no percentage. |
| PF-04 | Savings list | Accounts sorted from the highest balance; compact cards (type and currency beside the name); `...` menu: Edit, Archive. Archived accounts section: restore, delete (blocked if transactions use it). |
| PF-05 | Phone: more than 3 accounts | Shows the top 3 and **See more (n)** / **Show less**. Desktop: all accounts, no button. |
| PF-06 | Investment / Lent / Loan lists | Sorted from the highest value. |
| PF-07 | Tabs | Savings, Investment, Lent, Loan all fit without sideways page scroll. |

### 9.2 History chart and list

| ID | Scenario | Expected |
|---|---|---|
| PH-01 | Time frame dropdown | 1 month (this and last), 3, 6 (default), 9 months, 1, 3, 5 years, All time (from the earliest wallet/holding/loan/transaction). Chart and list change; the net worth card and Breakdown do not. |
| PH-02 | Long ranges | Chart thins its labels and hides dots; hover/tap shows exact value. |
| PH-03 | List rows | Month on the left, value bold with change and % below; very large amounts (tens of trillions) do not overflow. |
| PH-04 | Phone: list under the chart | Latest 3 periods with See more / Show less; desktop shows all. |
| PH-05 | Nothing to chart yet | Friendly empty message, no flat chart. |

### 9.3 Accounts (savings)

| ID | Scenario | Expected |
|---|---|---|
| AC-01 | + Account | Name prominent; currency, type, opening balance; created in the chosen currency. Counts from the period it is created in. |
| AC-02 | Edit an account | Name, type and **current balance** editable (adjusts the opening amount; past transactions untouched); currency cannot change. |
| AC-03 | An account created on a different calendar month than the period | Included in Savings, Total Balance and Net worth (they agree). |

### 9.4 Investments

| ID | Scenario | Expected |
|---|---|---|
| IV-01 | + Account (investment) | Name; appears with its holdings and total. A holding row has two lines: the asset name (one line, cut with … if long) and `12,000 USDT`; the value and the share % sit on the right; **no price in the row**. Tapping a row opens it **without a blue focus border**. |
| IV-02 | Add asset, picker | Account select, then a **type dropdown** (All, Crypto, US stocks & ETFs, Indonesia (IDX), Commodities) beside the search box; starts on All each time. |
| IV-03 | Search a US stock / crypto | Needs the Finnhub key on the server; shows live price; built-in assets work without it. |
| IV-04 | Search an IDX stock (BBCA) **(manual)** | Result "BBCA / Bank Central Asia"; a price appears (rupiah converted to USD). If Yahoo is unreachable: "price unavailable" and a typed price field. |
| IV-05 | Commodities **(manual)** | Gold / Silver per troy oz or per gram, Platinum, WTI, Brent, natural gas, copper; searching "emas", "gold", "oil" works. Gold per gram with 10 g at a known price gives the right value. |
| IV-06 | Pay with an account or USDT/USDC, or "Already owned" | Paid-from account decreases (transfer, not spending); "Already owned" leaves accounts untouched. Quantity is added **once**. |
| IV-07 | Buy / Sell on an existing holding | Quantity and the other side (account or stablecoin) move together; selling more than held is refused; deleting a trade restores both sides. |
| IV-08 | Price freshness | Prices (Finnhub and Yahoo) and exchange rates are cached on the server for **6 hours**; they load when the app opens (no Refresh button). Failures keep the previous price. There is no description line on the Investment tab: an **(i)** button next to the "Investments" title opens a small popover (prices and exchange rates update every 6 hours and can be delayed; estimates, not financial advice). Tap/click toggles it, hover shows it on desktop, tapping elsewhere closes it; on a phone it stays inside the screen. |
| IV-10 | Category list popup (phone browser) | The popup opens in the top layer (not clipped by the dialog edge). The Search box is fixed on top; the categories scroll; **Add new category is the last item of the scrolling list** (not pinned): scroll to the end and it is fully visible and tappable **(manual, real phone)**. |
| IV-11 | Tap a holding | Opens its detail: summary card (symbol, type · account, **You hold**, **Current price**, **Total value**, **Share of account**), **Buy** and **Sell** buttons, recent buys/sells (deletable), **Move to account**, then Remove / Close / Save. Buy/Sell work as before. |
| IV-12 | Cash (fiat) balance in an investment account | In the asset picker choose **Cash balance** (or tap **+ Cash** on the account card): the box next to it becomes a searchable currency list (IDR, USD, EUR...) and the chosen currency fills that field directly (no chip below). The account gets a cash holding ("Cash (IDR)"), paid from a savings account like a buy (or "Already owned"). Tap it: **Balance**, **Deposit** (money from a savings account) and **Withdraw** (back to a savings account); a withdrawal larger than the balance is refused. When you add/buy another asset in that account, the cash balance is offered under **Pay with > Cash balance** (only the same account's cash; another account's cash is refused). Selling an asset can credit the cash balance. Cash counts at face value in Investments and Total Balance; it is kept in the database as a manual holding (`provider_symbol` `cash:IDR`). |
| IV-13 | Asset history page | Tap an asset: the dialog shows the summary, Buy/Sell and a **View history** button (no trade list inside). **View history** opens a full page `#/portfolio/<id>` with the summary, Buy/Sell (Deposit/Withdraw for cash), Edit and **History**: every buy, sell, deposit, withdrawal, swap against a stablecoin and coin income/expense, newest first, each with a remove (×). **Back to Portfolio** returns. On phones each investment account card shows Edit / + Cash / + Asset in one even row under the name, also with a very long account name. Removing a trade there keeps you on the page. |
| AP-01 | Install nudge and session handoff | Only in a **mobile browser** (not desktop, not the installed app): a large **Use mobile app experience** button under Sign in on the landing page (same width as the Get started + Sign in row) and under the Total Balance card on Overview. It opens the Add to Home Screen steps (on iPhone including keeping "Open as Web App" on) (Android Chrome opens the install prompt). When signed in the dialog also shows a one-time code (valid 15 minutes) and the address gets `?handoff=CODE`; opening that address in the installed app signs it in without a password and removes the code from the address; the code works once. The code is also kept in a 15-minute cookie that only the installed app picks up (and clears); a plain browser never does. In the installed app, the landing page and Sign in have **Transfer from browser**: a correct code signs in, a wrong or used code is refused. The browser tab is signed out after the app takes over. |
| CU-01 | Currency format and selector | Amounts are written natively per currency: rupiah as `Rp 5.173.500.000` (dot thousands, comma decimals), dollars as `$2,701.96`; this does not change with the app language. Rupiah always shows `Rp`, never `IDR`, in amounts (currency codes still appear as labels such as "Amount paid (IDR)"). The Total Balance (Overview) and Net worth (Portfolio) heroes have the currency dropdown directly beside the big amount; changing it changes the reporting currency everywhere and the big amount still fits one line on a phone. |
| IV-14 | Average price and P&L | **Add asset** (no payment): optional **Average price** + currency (hidden for cash/stablecoins and when a payment source is chosen); adding more owned quantity of the same asset blends the starting price (4 @150 + 6 @200 = 10 @180). **Buy/Sell**: **Pay with** is the first field and the **Amount** and **Price per unit** are in that account's currency (IDR, USD, USDT/USDC...), following each other (qty x price = amount); the price is converted once into the asset's cost currency at the latest rate when saved (e.g. paying IDR 1,550,000 for 2 units of a USD asset records USD 50 each); the average becomes the weighted average on buys and does not move on sells; a sell realizes qty x (price - average). Tap the asset: **Average price, Cost, Profit / loss, Realized P&L, Starting price (Edit)**; the row shows P&L % (share of account when the cost is unknown). An asset without a starting price shows "—" and **Set average price**. History lists `@ price` per trade and P&L per sell. Trades dated in the future are not counted yet. Reload keeps all prices (`unit_price`, `cost_currency`). |
| IV-09 | Reload | Holdings keep type, name and price source (IDX = stock, commodity = Commodity). |

### 9.5 Lent and loans

| ID | Scenario | Expected |
|---|---|---|
| LN-01 | Add money lent / a loan | Card with balance, progress, monthly amount/rate (loan) or due date/note (lent). |
| LN-02 | Record a payment / repayment | Balance reduces; **not** counted as income or spending. Payments dated in the future do not reduce the balance yet. |
| LN-03 | Fully paid | Hint to archive; archived ones leave the lists and totals. |

Automated: `pfrange`, `wallet`, `arch`, `curdd`, `idx`, `run`, `ios`.

## 10. Settings

| ID | Scenario | Expected |
|---|---|---|
| ST-01 | Profile card | Display name, Reporting currency, **Budget period starts on**, Language, Appearance: label left, control flush right on one line, all inside the card. No description lines. |
| ST-02 | Categories | Always visible (no collapse toggle) in two clearly separated groups with headings and counts: **Expense** (red dot) and **Income** (green dot); no per-row type badge. On a phone each group shows its first **5** categories with **See more (n) / Show less**; desktop shows all. Each parent with sub-categories has an expandable "n sub-categories" toggle; `+ Sub` and `Edit` sit right-aligned on the same line. Adding a sub-category opens its parent and expands the list. |
| ST-03 | Add / edit / archive a category | Top-level or sub-category; a parent with children stays top-level; names unique per level. |
| ST-04 | Smart tagging toggle | Off: no AI tagging; on: tags only after enough labelled history, otherwise stays empty. |
| ST-05 | Recurring card | Appears only when rules exist (see section 6). |
| ST-06 | Account card | Signed-in email, Sign out, Sign out others, Use sample data. |
| ST-07b | Reload while sample data is on | After refreshing the page (any page, phone browser or desktop) sample mode comes back **with the sample data**: the yellow "Sample data" banner is never shown together with your own empty data (regression: two overlapping loads at sign-in left banner + own data). |
| ST-07c | Sample data content (Indonesian) | Sample mode shows an Indonesian account: banks **BCA, Mandiri, Bank Jago**, **Cash**, e-wallets **Gopay, ShopeePay, OVO**, investment accounts **Stockbit** (BBCA, BBRI, BMRI, TLKM) and **Ajaib** (ASII, VOO, AAPL, NVDA, BTC, USDT, gold per gram); savings about Rp 1.4 bn plus investments about Rp 3.8 bn (Stockbit and Ajaib each hold an IDR cash balance too) (about Rp 5 bn in total, net worth about Rp 4.1 bn after a **housing loan (KPR)**, a car loan and a credit card, with a friend who owes money). Six months of history, Indonesian merchants (Indomaret, Gojek, Kopi Kenangan, PLN...), monthly salary, subscriptions and e-wallet top-ups, **every transaction categorized (no "Uncategorized")**, November filled up to today plus Upcoming items later this month, a "Bali Trip" occasion, budgets, and 5 recurring rules in Settings > Recurring (salary, Netflix, Spotify, top-up transfer, BBCA buy). No account has a negative balance. Sample mode uses a **budget period starting on the 25th** (month pickers show ranges like "Oct 25 – Nov 24"); your own period setting is untouched when you leave sample mode. |
| ST-07 | Sample data toggle | On: a **compact one-line banner** on phones ("Sample data · not saved" + Back to my data; the long sentence on desktop) (at the top of the page, **not pinned**: it scrolls away with the content), demo account in memory, nothing saved; off: your own data returns untouched. Old "sample data saved earlier" rows can be removed. |
| ST-08 | Legal pages | Privacy and Terms open from the landing and sign-in screens. |

Automated: `cats`, `quickcat`, `sample`, `curdd`, `langsave`.

## 11. Budget period (custom start day)

Precondition: Settings > Profile > Budget period starts on = **Day 25**, today between the 25th and month end or earlier.

| ID | Scenario | Expected |
|---|---|---|
| PD-01 | Month pickers (Overview, Budgets, Activity) | Show ranges such as "Oct 25 - Nov 24" (Activity uses the compact "Oct 25-Nov 24"); the current period is selected. |
| PD-02 | Transactions on the 24th and the 25th | The 24th belongs to the previous period, the 25th to the new one; month totals, Money Flow, donut and budgets follow. |
| PD-03 | Save a transaction dated in another period | The view jumps to the period it falls in (if not in the future). |
| PD-04 | Budgets | Start from the selected period onward; the period name is the month it starts in. |
| PD-05 | Portfolio history | Balances, holdings and loans are measured at the end of each period; the net worth card matches Overview. |
| PD-06 | Change the start day back to 1 | Everything returns to calendar months; saved on the profile; same on a second device. |
| PD-07 | Day 28 | Works; February periods end on the 27th. |
| PD-08 | Account created in the calendar month the period ends in | Counted in Savings immediately (regression: Savings equals Total Balance). |

Automated: `period`.

## 12. Future-dated and upcoming entries

| ID | Scenario | Expected |
|---|---|---|
| FD-01 | Income dated tomorrow or later | Listed with an **Upcoming** badge; Total Balance, account balance, net worth, Money Flow, "this month", saved %, donut, budgets and occasion spent do **not** include it. |
| FD-02 | On the date | It counts everywhere after the next open (no server job needed). |
| FD-03 | Expense or loan payment dated later | Same: no effect until its day. |
| FD-04 | Future-dated USDT income | Holding does not change until the date (see CN-07). |

Automated: `coin`, `occtx`.

## 13. Saving, sync and data safety

| ID | Scenario | Expected |
|---|---|---|
| SY-01 | Make any change, reload | Persisted. Only the changed rows are sent (no resending of untouched tables). |
| SY-02 | Make a change on device A, open device B | B shows it after reload. |
| SY-03 | Server rejects a save (offline, error) | A toast says the last change could not be saved and your saved data is shown again; no silent loss. Closing the tab with a pending save warns. |
| SY-04 | Delete a wallet, holding or category that is in use | Blocked or handled with a clear message; no orphan rows. |
| SY-05 | Currency maths | IDR/JPY have no decimals; USD/EUR have 2; a value entered on one device shows the same on another (no 100x errors). |
| SY-06 | Money edge cases | 0.01, very large numbers, rounding on conversions: totals add up to the shown parts. |
| SY-07 | Database checks (after schema changes) | Security advisor shows no new warnings; every new table has RLS with per-user policies. |

Automated: `run`, `wallet`, `sample`, `fake_supabase.js` log assertions.

## 14. Deployment smoke test (after every release)

1. Vercel: latest production deployment is Ready for the commit just pushed **(manual)**.
2. Open https://stiver.io on desktop and phone, hard reload / reopen the installed app so the new service-worker cache loads.
3. Sign in, open Overview, Activity, Budgets, Portfolio (all tabs), Settings: no blank screens, no console errors.
4. Add one expense, see it on Overview and in Activity, delete it.
5. Switch language and theme and back.
6. Check `/api/status` returns JSON; if Finnhub is configured `"finnhub": true`, and `"yahoo": true`.
7. For database changes: confirm the migration is applied and the app still loads existing data.

## Automated coverage map

| Test (`tests/e2e/…`) | Main areas |
|---|---|
| `run`, `sample`, `curdd` | sign-in, add/edit/delete, budgets, occasions, portfolio basics, demo mode, currency |
| `cats`, `quickcat` | categories, sub-categories, inline category creation |
| `transfer`, `wallet`, `arch` | transfers and fees, account edit, archive/restore/delete |
| `budgetbar`, `occtx`, `ovocc` | budget bars, occasions and their periods |
| `daily` | daily Transactions view and day page |
| `donut` | spending donut hover/tap, Budgets month picker |
| `pfrange` | Portfolio time frames, sorting, See more, history list |
| `recurring` | recurring rules, date maths, catch-up, pause/delete |
| `coin` | USDT/USDC income and expenses, future-dated entries |
| `period` | custom budget period |
| `idx` | IDX and commodity assets (stubbed prices) |
| `handoff` | install button only on mobile browsers, one-time session code, claim by address and by typing |
| `avgprice` | average price at add, buy re-averages, sell realizes P&L, price/amount sync, set average price, blending, reload |
| `cashacct` | fiat cash balance in an investment account: currency dropdown, + Cash button, deposit, buy with it, withdraw, View history page, reload |
| `noscroll` | no sideways overflow at 360 and 390 px, zoom lock |
| `dropdown` | app-styled dropdown lists: open, choose, Esc, outside tap, keyboard, groups, inside dialogs |
| `ios`, `confirm`, `csp`, `landshot`, `langsave`, `darkshots`, `idcrawl` | phone rendering, email confirmation flow, CSP, landing, language and dark mode |
| `tests/test_yahoo.py` | Yahoo price/search parsing and unit conversion (stubbed) |

## Not covered by automation (always check manually)

Real Google sign-in and emails, the installed home-screen app, live Finnhub and Yahoo prices, Vercel deployment, behaviour
on a real phone keyboard, and anything that depends on the current date being a specific day of the month.

## Change log of this file

- 2026-11-01: First version, covering all features up to the Commodities asset type.
- 2026-11-01: IV-08 now covers the price-refresh disclaimer on the Investment tab.
- 2026-11-01: IV-08 rewritten for the 6-hour price cache and the single disclaimer (Refresh prices button removed).
- 2026-11-01: IV-08 now describes the disclaimer as an (i) tooltip next to the Investments title.
- 2026-11-01: OV-01 hero percentage is now the balance change %, not the saved-income %.
- 2026-11-01: OV-05 rewritten: Overview Budgets card shows only the overall budget, button renamed Details, whole card opens Budgets.
- 2026-11-01: UI-06 notes the tighter space under the bottom bar labels.
- 2026-11-01: CN-01/02/08 use the `Investment Account` group and `Name (USDT)` format.
- 2026-11-01: TX-01 (new Activity header) and PF-01 (no "after loans" label).
- 2026-11-01: ST-02 rewritten for the Expense / Income groups and the phone-only top-5 limit.
- 2026-11-01: TX-03 covers the day page search box and the Back link spacing.
- 2026-11-01: IV-01 covers the smaller holding type tag and the space after ×.
- 2026-11-01: UI-06: the Add label is exactly level with the other bottom-bar labels.
- 2026-11-01: TX-07 rewritten (Add new category inside the Category dropdown, no auto keyboard), TX-07b/c added.
- 2026-11-01: TX-07c now checks that no native picker reopens after choosing (focus is no longer returned to the select after a tap).
- 2026-11-01: TX-07b: tapping the search box must not close the list (phone keyboard resizes the page).
- 2026-11-01: TX-07b: "Category not found" note above the Add new category button when the search has no match.
- 2026-11-01: Added UI-12 (the new loading screen).
- 2026-11-01: Added OV-01b (sample-data offer on Overview for empty accounts).
- 2026-11-01: AUTH-01: landing header spacing, outlined Sign in, no hero mock-up card, new demo video.
- 2026-11-01: ST-07: compact phone banner, not sticky.
- 2026-11-01: OV-06: transaction rows show only the sub-category name.
- 2026-11-01: UI-04b: no pull-to-refresh in phone browsers.
- 2026-11-01: OV-05b/OV-06/UI-04b: Try sample data button, new transaction row layout, pull-to-refresh left on in browsers.
- 2026-11-01: ST-07b: sample mode survives a reload.
- 2026-11-01: TX-07b: Add new category is pinned (sticky) at the bottom of the list.
- 2026-11-01: TX-07b: list = fixed search + scrolling options + fixed Add new category footer.
- 2026-11-01: ST-07c (Indonesian sample data), IV-10 (category popup: scrollable, Add new category last, top layer).
- 2026-11-01: OV-01: Total Balance = savings + investments, with an (i) tooltip.
- 2026-11-01: ST-07c: no DBS SG, adds a housing loan, sample period starts on the 25th.
- 2026-11-01: TX-02 (count only), UI-13 (pages open at the top).
- 2026-11-01: IV-01: tidier holding rows, no focus ring on tap.
- 2026-11-01: IV-01/IV-11: no price in holding rows; a detail view with price and actions.
- 2026-11-01: IV-12: fiat cash balance in investment accounts.
- 2026-11-01: Added UI-11 (app-styled dropdown lists) and the `dropdown` test to the coverage map.
- 2026-11-01: OV-01 no longer expects the "N accounts" label on the hero card.
