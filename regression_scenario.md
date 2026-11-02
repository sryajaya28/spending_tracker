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
| UI-13 | Move between pages (tab bar, sidebar, links, browser Back) after scrolling down | Within the same session each page **remembers its scroll position**: scroll Overview down, go to Budgets (opens at the top the first time), come back to Overview and you are where you left it (same for Budgets, Transactions...). A page you have not visited yet opens at the top, and a button that opens Transactions with a new filter (a trend bar's View transactions, occasion Details, loan Details, global search) starts at the top. Reloading the app forgets the positions. |
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
| OV-03 | Money Flow | Six periods of income and spending; hover/tap on the chart shows a tooltip with the period, Income, Spending and Net. Saved shows income minus spending of the selected period. |
| OV-04 | Spending donut | Top 5 categories + Others. Hover (desktop) or tap (phone) an arc: centre shows name, amount and % of total; tap the same arc or elsewhere to clear. Empty month: grey ring and zero total. No category buttons under it. **Details** opens the breakdown with expandable sub-categories. |
| OV-05 | Budgets card | Shows **only the overall budget** ("All spending": spent / budget · %, empty bar at 0%): no category budgets and no special occasions on Overview. The button says **Details**; tapping the button or anywhere on the card (except the month picker) opens the Budgets page. The period dropdown on the card also changes the Spending card (shared period). Without an overall budget it says "No monthly budget". |
| OV-06 | Recent transactions | Latest rows, "View all" goes to Activity. Each row: title and amount on the **same line**, `Category · Account` below the title and the **date below the amount** (right aligned); there is **no "Uncategorized" tag** (an uncategorized row just says "No category"); for a sub-category only the sub-category name is shown ("Public transit", not "Transport › Public transit"). |
| OV-07 | Add/Edit through any entry point | After saving, numbers on the page refresh immediately. |

Automated: `donut`, `ovocc`, `budgetbar`, `run`.

## 4. Transactions (Activity)

| ID | Scenario | Expected |
|---|---|---|
| TX-01 | Open Activity | Line 1: the search box on the **left** (placeholder "Search") and the period dropdown on the **right**; **no `+ Add` button on phones** (the bottom bar Add does it), it stays at the end of line 1 on desktop. Line 2 (text centred in each pill): the three filters keep their full labels **All categories / All occasions (only when occasions exist) / All accounts**, sized in proportion so none is cut off at 360-390 px. |
| TX-02 | Daily list | One row per day, newest first: day number and month, the weekday with the **transaction count underneath** (nothing else), and the day's net amount on the right (same colour as everything else; the +/− sign shows the direction). Transfers count in the number but not in the net. |
| TX-03 | Expand a day | Tap a day row (chevron on the right): its transactions open right under it, indented, without leaving the page (the address stays `#/transactions`); tap again to hide. **Expand all** and **Hide all** (above the list, right-aligned) open or close every listed day. Typing in Search opens every matching day; clearing it returns to your own open/closed choices. The open part of a day has its own block background (greyer in light mode, lighter in dark mode). Tapping a transaction inside opens it for editing; the open days stay open after saving. The old day page `#/transactions/YYYY-MM-DD` still works if opened by address but nothing links to it. |
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
| BU-05 | Special occasion budget | Create with **+ Add** (top right of the Special occasions card; was "+ Occasion") with a name, amount, optional dates; "+ Expense" opens the form preselected; "Details" (was "Expenses") opens Transactions filtered to its expenses; the row shows only the date range. |
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
| AP-01 | Install nudge and session handoff | Only in a **mobile browser** (not desktop, not the installed app): a large **Use mobile app experience** button under Sign in on the landing page (same width as the Get started + Sign in row) and under the Total Balance card on Overview. It opens the Add to Home Screen steps (on iPhone including keeping "Open as Web App" on; iPhone shows a looping how-to animation with Safari / Chrome tabs (Safari: ≡ in the address bar > Share > Add to Home Screen; Chrome: Share icon in the address bar, scroll to Add to Home Screen) and the button **Close**; Android shows its install prompt or plain ⋮ menu steps; tap outside also closes) (Android Chrome opens the install prompt). When signed in the dialog also shows a one-time code (valid 15 minutes) and the address gets `?handoff=CODE`; opening that address in the installed app signs it in without a password and removes the code from the address; the code works once. The code is also kept in a 15-minute cookie that only the installed app picks up (and clears); a plain browser never does. In the installed app, the landing page and Sign in have **Transfer from browser**: a correct code signs in, a wrong or used code is refused. The browser tab is signed out after the app takes over. |
| OV-TR | Category trend (Overview) | Between **Spending** and **Budgets** a **Category trend** card shows stacked bars per period (default 6 months; choose 1, 3, 6 or 12 months) and a searchable category dropdown (default All categories). All categories: each bar is split by top-level category with a legend (top 6 + Others). Choose a category that has sub-categories: bars split by sub-category (and "Not in a sub-category"). Choose a sub-category, or a category without sub-categories: single-colour bars. Only one category at a time. Tap a bar (the chart has a colour legend but no hint text): a dialog lists that period's breakdown with amounts and %, and **View transactions** opens Transactions on that period and category. No spending in the range shows an empty message; future-dated expenses are not counted. |
| TX-AC | Account follows the last one used | In **Add transaction** the Account is preselected as the one you used for your previous *new* expense; Income has its own remembered account, and Invest remembers its Pay with and the investment account. Switching Expense/Income in the dialog switches to that type's remembered account. With nothing remembered on this device (first use, another phone, older records) it uses the account of your latest expense/income/investment on record; with no record at all, or if that account was archived/removed, it starts on the first account in your reporting currency. Editing a transaction does not change it. The memory is per device and is not used in sample mode. |
| UI-MS | Modal does not scroll the page | Scroll a page down, open any modal (Add, an asset, Install...): dragging or wheeling outside the modal does not move the page behind; the modal's own content still scrolls. Closing it (button, Esc, or a tap/click on the dimmed area outside it; dragging from inside to outside, or a tap that only closes an open dropdown list, does not close it) returns to the same scroll position. Check on a real iPhone too (Safari and the installed app). |
| RC-ED | Recurring: first date and editing (list: expense amounts red with −, income green with +) | Add an expense that repeats monthly with a date a few days ahead: Settings > Recurring shows **Next** = that date (not a month later) and the entry is on the list once as Upcoming; when the day arrives no second copy appears. In Settings each rule has one **Manage** button: its dialog has the **payment account** (Account / From + To / Pay with), the **Category** (expense/income rules), **Amount** (unit follows the account) and **Next payment** (today or later) with Save, plus **Pause/Resume** and **Delete**. Saving: the next entries use the new amount and day; entries already made keep their old amount and date. An entry that is still Upcoming and was entered together with the rule moves with the edit (no stale duplicate). |
| SP-01 | Report a bug / send feedback | A chat button sits just left of the profile icon in the top bar of every page. It opens **Help & feedback**: choose **Report a bug** or **Suggest an improvement**, write up to **250 characters** (counter shows n/250, typing stops at 250), add up to **5 screenshots** (images only; a photo over 1 MB is shrunk automatically; at 5 the Add tile disappears; × removes one). **Send** stores one row in `support_reports` with the type, the message, the image paths, the user's id and email (added by the database) and device context, and uploads the images to the private `support-attachments` bucket; a failure keeps the form open so nothing is lost; success shows a thank-you toast. In sample data mode it is not sent (message to switch back). |
| LN-AC | Loan account as payment account | In **Add expense** the Account list has three titled groups (**Savings Account**, **Investment Account** and **Loan Account**, each a tinted heading with a gap before it) and the loans are in the last group (name, currency, amount owed); income and transfers cannot use it. The loan options show only name and currency (no owed amount). Paying an expense with a loan: it counts as spending (budgets, Spending, trend) but no wallet changes, and the loan's balance goes **up** by the amount (the card only shows the new balance; **Details** lists the charged amount, every payment and the "charged" rows; the progress bar uses original + charged). Editing the expense (amount, date, account) updates or removes that charge; deleting the expense removes it; a loan payment still lowers the balance. Charges dated in the future are not in the balance yet. Recurring expense rules can use a loan account. After reload everything is the same. |
| LN-DT | Loan Details opens the Transactions page | Loan and personal-loan cards show balance, progress and **Edit / Details / + Payment**, no payment list. **Details** opens **Transactions** with the **Account filter preselected to that loan** (the filter has Savings Account, Investment Account and **Loan Account** groups) in the period of the loan's latest entry; use the period picker for earlier months. Rows: each expense paid with the loan as `+amount` (it raised the loan), each payment as **Loan payment** `−amount`; the day total is charges minus payments; no "charged" wording. Searching 'payment' keeps only the payments; picking a category hides payments. Lent cards still open a **Details** dialog with the repayments. |
| UI-LAUNCH | App start on iPhone | Open the Home Screen app: the launch screen is the Stiver splash (light purple, logo, name), not a black screen, then the animated splash, then the app. In a browser the splash appears immediately (before the scripts finish loading). After a launch-image change, remove and re-add the Home Screen app if the old screen still shows. |
| PF-CASHQ | Fiat cash decimals | A cash balance in an investment account (e.g. Cash (IDR) in Ajaib) shows its amount with at most 2 decimals under the name, in the asset dialog, in the Pay-with list and in its history (never 46,600,560.99999999) and with the currency's own separators (IDR: 46.600.561); crypto amounts still show up to 8 decimals. |
| RC-LINK | Rule edit reaches the upcoming entry | A recurring rule whose first payment is still upcoming (e.g. Apple Music, next Nov 17): after Manage > change the account (or amount, category, date), Transactions > See upcoming transactions shows the same account, amount and date. Rules edited before this existed (entry still on the old account or date) are repaired the next time the app opens, and when the rule's date arrives only one entry exists. |
| AU-START | Where a session starts | Log in: you land on Overview at the top, even if you were on another page (e.g. Settings, scrolled down) when you logged out. Log out (button at the bottom of Settings): the landing/sign-in page is at the top, not scrolled down. Closing and reopening the app while still signed in keeps the page you were on. |
| OV-BUD0 | Overall budget on Overview | The Budgets card shows the amount spent, "of Rp y monthly budget · n%" and the overall progress bar right under it (red when over budget); no "All spending" label row. |
| OV-BUD | Budgets card on wide screens | Overview in a window wider than 1100 px: under the overall budget the card lists the other budgets (most used first, then live special occasions) as many as fit the card's height, whole rows only, no empty gap and the card is not taller than the one beside it; resizing the window re-fits the list. At 1100 px and narrower and on phones only the overall budget shows. |
| OV-LEG | Spending donut legend | Overview > Spending: under the donut a centred legend lists the categories shown (up to 5 plus Others) with their icon and a dot in the same colour as the arc, in the same order; it wraps on a phone; not shown when there is no spending. |
| OC-NB | Occasion without a budget | Settings > Special occasions > + Add: name only (budget optional, dates optional) saves; the card shows it as "No budget". It does not appear on Budgets, but can be tagged to an expense (Add transaction > Special occasion, and the Occasion filter). Budgets > Special occasions > + Add: an **Occasion** picker lists the pre-added occasions without a budget (and + New occasion); picking one hides name/dates and asks only for the budget, which is required there; saving puts it on Budgets with progress and does not create a duplicate. An occasion created from Budgets also shows in Settings. Clearing the budget in Edit (Settings) removes it from Budgets but keeps it in Settings. An occasion with a budget that has not ended yet (e.g. a trip next month) shows on Budgets in every period; one that ended shows only in the periods it spans or has expenses in. |
| OC-HIST | Occasion history | Budgets > Special occasions > **History** (always shown, left of + Add; it says so when nothing is past yet) opens "Past special occasions": each row shows the name (Archived badge if archived), the dates with the year once when both are in one year (Mar 10 – Mar 12, 2026), the total spent and, if it had a budget, the percentage. **Details** closes the pop-up and opens Transactions with the Special Occasion filter set; the period shows the single period that holds its expenses, or **All periods** if they are in several periods. Ended occasions are no longer in the live Budgets list. |
| FE-01 | Fees are recorded | A transfer fee, and the fee of buying or selling an asset (optional Fee field in Buy/Sell and in Add asset when paying from an account), each add a separate expense on that account named "Transfer fee (A → B)" / "Investment fee (Bought 0.01 BTC)", in the **Fee** category with the 💸 icon, no tag on the row, − sign. No fee entered: no record. A buy needs amount + fee in the balance. The Fee category is in Settings > Categories for every account (created on first load; earlier transfer fees are put in it). |
| TX-XFER | Transfer rows | A transfer between two accounts is **one row**: "Transfer to X" under the sender account, the amount only (no "Transfer" tag, no + or − sign, no typed note; the note is in the transfer's detail pop-up). Filtering by the receiving account also shows the incoming record. Its fee, if any, is a separate row tagged "Transfer fee" with a − sign. Same on Overview > Recent transactions and on a day's page. |
| TX-SEP | Period headings | With **All periods** (or an occasion whose expenses span months) the list has a heading for each period (e.g. NOVEMBER 2026) with a line, newest first; with one period there are no headings. Expand all / Hide all stay on the right; pressing one shows a pill with the text in its middle (no highlight stays after a tap on a phone). |
| TX-ALL | All periods | The Transactions period picker starts with **All periods** and lists every period back to the first transaction (newest first). Choosing it shows every past transaction (filters still apply) and does not change the period used on Overview and Budgets; choosing a period leaves it. After signing out and in (or reopening the app) the page starts on the current period. |
| OC-TAG | Budget Added tag | Budgets > Special occasions > + Add: the Occasion list shows every occasion; ones that already have a budget are greyed out, tagged **Budget Added** and cannot be chosen; the first one without a budget is preselected (or + New occasion when all have one). |
| TX-ORD | Same-day order | Add three expenses on the same date one after another: Overview > Recent transactions and the day on the Transactions page list the last one entered first; the order stays after a reload or on another device. |
| TX-UP | Upcoming entries on the Transactions page | The Transactions (Activity) list shows nothing dated after today; upcoming entries appear on their day (they are also hidden from Overview > Recent transactions). When the period has upcoming entries matching the filters, a centred text link **See upcoming transactions (n)** (not a filled button) shows under the list (also when the list is empty); it opens a pop-up listing them soonest first with the Upcoming badge; tapping one opens it for editing; no button when there are none. |
| CN-AM | Stablecoin amounts | A transaction or recurring entry paid from / received in a USDT or USDC balance shows its amount as `USDT 5,584.00` / `USDC ...` (with the usual + or −), never with a `$` sign; it still counts in totals converted to the reporting currency. |
| BU-CA | Add a category budget | The **By category** card has its own **+ Add** button (like Overall budget's + Budget); it opens Add budget already on a category that has no budget yet (not "All spending"). |
| UI-DP | Date picker | Date fields show the date as **2 Nov 2026** (day, short month, year) on every phone and browser, never 11/02/2026; the text is left-aligned, vertically centred and the field is the same width as the other fields and the same width as the other fields (on iPhone the date was centred and the box ran past the dialog edge). Tapping any date field (Add transaction, Transfer, Invest, loans, occasions, recurring...) opens an **app-styled calendar** under the field instead of the iPhone/OS calendar: month and arrows, weekdays, today marked, the current value selected, **Today** shortcut. Choosing a day fills the field and closes it; fields with a minimum date (e.g. recurring next payment) disable earlier days; a tap outside or Esc closes only the calendar, not the dialog; works in light and dark mode and on a phone. |
| TX-FL | Active filter highlight and Reset filters | On Transactions a filter that is set (category, occasion, account, or text in Search) is tinted with the brand colour and bold; while any is set a **Reset filters** link shows at the left of Expand all / Hide all (also when nothing matches). Tapping it clears search, category, occasion and account (highlights disappear) and keeps the period. |
| BU-TX | Budget row opens its transactions | On Budgets > By category, tapping a category row (not its Edit button) opens Transactions with that category already selected (highlighted, with its icon) for the same period. Edit still opens the budget editor. |
| TX-CI | Category icons in the filter | The Transactions category filter list shows each category's icon (sub-categories indented with ↳); searching a parent name also finds its sub-categories. |
| CU-01 | Currency format and selector | Amounts are written natively per currency: rupiah as `Rp 5.173.500.000` (always a space after Rp, also on iPhone) (dot thousands, comma decimals), dollars as `$2,701.96`; this does not change with the app language. Rupiah always shows `Rp`, never `IDR`, in amounts (currency codes still appear as labels such as "Amount paid (IDR)"). The Total Balance (Overview) and Net worth (Portfolio) heroes have the currency dropdown directly beside the big amount; changing it changes the reporting currency everywhere and the big amount still fits one line on a phone. |
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
| ST-03b | Category icon | In the category dialog and in the quick add inside Add transaction, the Icon field holds the current icon (🏷️ by default) and it can be deleted; tapping the field selects it so typing an emoji replaces it; typing a second emoji keeps only the new one; a row of common icons shows **only while the Icon field is active** (hidden until the field is tapped, hidden again when another field is tapped) and can be tapped instead (the chosen one is outlined; the row stays open after a pick); the saved category uses that icon. |
| ST-04 | Smart tagging toggle | Off: no AI tagging; on: tags only after enough labelled history, otherwise stays empty. |
| ST-05 | Recurring card | Appears only when rules exist (see section 6). |
| ST-06 | Account card | Signed-in email, Sign out, Sign out others, Use sample data. |
| ST-07b | Reload while sample data is on | After refreshing the page (any page, phone browser or desktop) sample mode comes back **with the sample data**: the yellow "Sample data" banner is never shown together with your own empty data (regression: two overlapping loads at sign-in left banner + own data). |
| CY-INRPHP | ₹ and ₱ | Settings > Reporting currency (and the currency chip on Overview) offers **INR** and **PHP**. Choosing INR: amounts use lakh/crore grouping (₹12,34,567.00; a total in crores reads ₹2,38,72,700.00) and chart axes read 50K, 1 L, 2.3 Cr; choosing PHP shows ₱1,234,567.00. Live rates load for both (Settings shows the rate source/date like the other currencies; values follow the market). Sample data in either currency has local banks, e-wallets, merchants, brokers and NSE/PSE stocks and every scenario (fees, trades, occasions). |
| ST-07e | Sample scenarios | In sample mode (any country) there are 12 periods of history (Transactions > All periods shows a heading per period and a year change), transfers with a fee row (Fee category, 💸), a buy and a sell on stocks with an Investment fee row each (Portfolio > the stock > history lists them), and special occasions of every kind: upcoming and ongoing ones on Budgets, three past ones under History (one ended in one period, one across two periods so Details opens All periods, one archived without a budget), a no-budget one only in Settings. Occasion names and what was spent on are local to the country (e.g. Kyoto Weekend for JPY). |
| ST-07d | Sample data per country | The sample account follows the reporting currency: **IDR** Indonesian (BCA, Mandiri, Gopay, Stockbit, Ajaib...), **SGD** (DBS, OCBC, GrabPay, Tiger Brokers, moomoo, FairPrice, Kopitiam), **HKD** (HSBC, Hang Seng, Octopus, Futu, ParknShop), **JPY** (MUFG, PayPay, Suica, SBI Securities, Seiyu), **USD** (Chase, Venmo, Fidelity, Coinbase, Walmart), **EUR** (ING, N26, Trade Republic, Lidl), **GBP** (Barclays, Monzo, Hargreaves Lansdown, Tesco), **AUD** (CommBank, CommSec, Woolworths), **CNY** (ICBC, Alipay, WeChat Pay, Futu Niuniu, Hema Fresh). Each has local stocks, cash in that currency, a global broker, loans, a friend you lent to, a trip occasion and budgets; every transaction is categorized, no account is negative and every holding has an average price. Switching the reporting currency in sample mode (Settings or the hero dropdown) re-creates the sample for that country and leaves your own currency setting alone; a currency without a profile uses the USD sample. HKD and CNY are selectable currencies everywhere. |
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
| `cats`, `quickcat` | categories, sub-categories, inline category creation, icon field (clear, replace, pick) |
| `transfer`, `wallet`, `arch` | transfers and fees, account edit, archive/restore/delete |
| `budgetbar`, `occtx`, `ovocc` | budget bars, occasions and their periods |
| `daily` | collapsible days: expand one, expand all, hide all, search opens matches, edit inside; upcoming hidden from the list and shown in the See upcoming pop-up; same-day entries latest first (also after reload) |
| `fees` | Fee category, investment fee on buy/sell, fee rows |
| `inrphp` | ₹/₱ choices, live rate request, Indian grouping and L/Cr axes, peso format, sample accounts |
| `loginstart` | login opens Overview, logout scrolls to top, saved session keeps the page |
| `ovbud` | Overview budgets fill the card on wide screens only |
| `occnobudget` | occasions without a budget: Settings card, picker on Budgets, tagging |
| `donut` (also OV-LEG legend matches the arcs) | spending donut hover/tap, Budgets month picker |
| `pfrange` | Portfolio time frames, sorting, See more, history list |
| `recurring` | recurring rules, date maths, catch-up, pause/delete |
| `coin` | USDT/USDC income and expenses, future-dated entries |
| `period` | custom budget period |
| `idx` | IDX and commodity assets (stubbed prices) |
| `samplelocal` | localized sample data for all nine currencies and the USD fallback |
| `lastacct` | add dialog preselects the last account used per expense / income / investment |
| `modalscroll` | page behind a modal is pinned; scroll position restored on close |
| `recedit` (also RC-LINK: unlinked upcoming entry repaired, Manage edit follows into it) | recurring: next date for a later first payment, Manage dialog, edit amount/date without touching history |
| `support` | support button placement, 250 chars, 5 images / 1 MB, shrink, insert with type, failure keeps form, sample mode |
| `loanpay` | loan account as payment account: raises the loan, edit/move/delete, reload, recurring |
| `datepick` | app calendar (open, choose, navigate, Today, min, outside/Esc) and active filter highlight |
| `scrollpos` | each page keeps its scroll position within the session; filtered views start at the top |
| `trend` | category trend card: placement, 1/3/6/12 months, category split, sub-category split, bar details and View transactions |
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
