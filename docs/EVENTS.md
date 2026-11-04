# Stiver: complete analytics event reference

Everything that is sent to PostHog (Cloud EU, project 334082), as implemented on 2026-11-04. Companion to
`docs/ANALYTICS.md` (the checklist to follow when adding features). Keep both current in the same commit as any tracking
change. Code: `prototype/analytics.js` (listeners, scrubbing, `Analytics.*` API) and the `Analytics.track(...)` calls in
`prototype/app.js`.

## 1. Where events come from

| Layer | Status | Notes |
|---|---|---|
| **Frontend (browser)** | **Implemented**: every event below | Sent by the posthog-js SDK through our own `/ingest` address (Vercel rewrite to `eu.i.posthog.com`). |
| **Backend** (Vercel `/api/*`, Supabase database, Auth, Edge) | **No events are sent today** | See section 7 for what could be added and how. Backend activity is visible only in Supabase and Vercel logs, not in PostHog. |

## 2. Properties on every event

| Property | Values | Source |
|---|---|---|
| `page` | `landing` (signed out), `overview`, `transactions`, `budgets`, `portfolio`, `settings` (the first part of the address; never a date or id) | `before_send` |
| `lang` | `en`, `id` | page language |
| `theme` | `light`, `dark` | applied theme |
| `viewport` | `mobile` (width up to 700 px), `desktop` | window width |
| `env` | `production`, `staging` (staging also covers every preview link) | `config.js` (`STIVER.ENV`) |
| `app` | `stiver` | constant |
| `distinct_id` | the Supabase account id (random uuid); a random anonymous id before sign-in | `Analytics.identify` |
| PostHog's own `$` properties | browser, OS, screen size, `$current_url` (cut at `?` and `#`), `$referrer`... | SDK |

**Person properties** (set after the data loads): `currency` (reporting currency code), `language`, `theme`.
No email, name or any financial value is ever stored on the person.

## 3. Automatic interaction events (no per-feature code needed)

| Event | Properties | Fires when |
|---|---|---|
| `$pageview` | `page` | a page is opened or the address changes to another page (the same page twice in a row counts once; the sample-data demo is silent) |
| `button_clicked` | `action`, `element` (tag name), `in_dialog` (true if a pop-up is open), plus `view`, `tab`, `side`, `type`, `kind`, `route`, `preset` when the element has them | any click on an element with `data-act` |
| `nav_clicked` | `to` (page name) | click on an internal `#/...` link without `data-act` |
| `link_clicked` | `host` | click on an external `http(s)` link |
| `dialog_opened` | `form` (the form kind, or `info` for read-only pop-ups) | a pop-up opens (not when it re-renders) |
| `form_submitted` | `form`, `edit` (true when editing an existing record) | a form with `data-form` is submitted; it is an attempt: validation may still refuse, the outcome events in section 4 confirm success |
| `setting_changed` | `setting` (`currency`, `period`, `ai`, `language`), `value` (currency code, period start day, true/false, language code) | the matching Settings or header control changes. The display name is never tracked. |
| `filter_changed` | `filter` (`cat`, `occ`, `wallet`), `active` (a value is chosen) | a Transactions filter list changes; the chosen category, occasion or account is **not** sent |
| `period_changed` | `all_periods` | the month/period picker changes |
| `range_changed` | `range` | the portfolio chart range changes |

### 3.1 Values of `button_clicked.action` (snake_case, from `data-act`)

| Area | Values |
|---|---|
| Sign-in and session | `auth_view` (with `view` = landing/signin/signup/forgot/sent), `auth_google`, `auth_check`, `auth_resend`, `signout`, `revoke` (sign out other devices), `retry_load` |
| App chrome | `theme_toggle`, `install_app`, `support`, `guide_tab`, `toggle_info`, `toggle_more`, `goto` (card that opens a page, with `route`), `close` |
| First run and demo | `onb_skip`, `congrats_add`, `demo_on`, `demo_off`, `remove_sample` |
| Transactions | `add_txn` (with `type` = expense/income), `edit_txn`, `delete_txn`, `open_day`, `toggle_day`, `days_all`, `days_none`, `cat_txns`, `reset_filters`, `see_upcoming`, `view_history` |
| Transfers | `transfer`, `transfer_dialog`, `view_transfer`, `delete_transfer` |
| Categories | `add_cat`, `edit_cat`, `archive_cat`, `toggle_cat`, `quick_cat_add`, `quick_cat_cancel`, `pick_icon`, `breakdown`, `trend_detail`, `trend_go` |
| Budgets and occasions | `add_budget`, `edit_budget`, `delete_budget`, `add_occasion`, `add_occasion_budget`, `add_occasion_txn`, `edit_occasion`, `archive_occasion`, `delete_occasion`, `occasion_archived`, `occasion_history`, `view_occasion` |
| Recurring | `rec_toggle`, `rec_manage`, `rec_del` |
| Accounts (savings) | `add_wallet`, `add_account`, `edit_wallet`, `edit_account`, `archive_wallet`, `archive_account`, `restore_wallet`, `delete_wallet`, `wallet_menu`, `toggle_arch` |
| Portfolio and investments | `pf_tab` (with `tab`), `pnl_month`, `invest`, `trade` (with `side`), `add_holding`, `edit_holding`, `delete_holding`, `delete_trade`, `pick_asset`, `manual_asset`, `set_cost` |
| Loans and money lent | `add_loan`, `edit_loan`, `archive_loan`, `unarchive_loan`, `loans_archived`, `loan_payment`, `pay_loan`, `history_loan`, `add_lent`, `edit_lent`, `archive_lent`, `lent_repayment`, `pay_lent`, `history_lent`, `delete_payment` (with `kind` = loan/lent) |
| Support | `shot_del` |

Values are the `data-act` codes with `-` turned into `_`. A new button is picked up automatically as soon as it has a
`data-act`; add it to this table in the same commit.

### 3.2 Values of `dialog_opened.form` and `form_submitted.form`

`txn`, `transfer`, `wallet`, `account`, `budget`, `cat`, `occasion`, `loan`, `lent`, `payment`, `recedit` (recurring rule),
`holding`, `trade`, `cost`, `support`, `handoff`, plus the sign-in forms `signin`, `signup`, `forgot`, `recovery`; `info` for
pop-ups without a form.

## 4. Named business events (the outcome happened and was saved)

Fired in `prototype/app.js` right before `save(); close(); render();`, only on the success path.

| Event | Properties | Meaning |
|---|---|---|
| `signed_up` | `confirmed` (true when the account is usable without an email link) | account created |
| `signed_in` | none | a real login (not a reopened saved session) |
| `onboarding_skipped` / `onboarding_completed` | none | first-run flow skipped / finished (celebration screen) |
| `demo_on` / `demo_off` | none | sample data switched on / off (the only events sent in demo mode) |
| `expense_recorded` / `income_recorded` | `type`, `payment_source` (`account`, `stablecoin`, `debt`), `has_category`, `has_occasion`, `is_recurring` | a new transaction |
| `update_transaction` | same properties | a transaction was edited |
| `delete_transaction` | `type` | a transaction was deleted |
| `transfer_recorded` | `has_fee`, `is_recurring` | a transfer between accounts |
| `trade_recorded` | `side` (`buy`, `sell`) | an asset was bought or sold |
| `add_asset` | `funded` (paid from an account or coin) | an asset was added to a portfolio |
| `debt_payment_recorded` | `kind` (`loan`, `lent`), `is_recurring` (a repeating payment was set up; loans only) | a loan payment or lent repayment |
| `add_category` / `add_sub_category` | `type` (`expense`, `income`), `source` (`settings`, `quick_add`) | category created |
| `restore_category` | `type` (`expense`, `income`), `level` (`category`, `sub_category`) | an archived category restored |
| `update_category` | `type`, `source` | category edited |
| `add_account` | `type` (`cash`, `bank`, `ewallet`, `card`) | savings account created |
| `add_budget` / `update_budget` | `scope` (`overall`, `category`) | budget created / edited |
| `delete_budget` | none | budget deleted |
| `add_occasion` / `update_occasion` | `has_budget`, `has_dates` | special occasion |
| `add_debt` / `update_debt` | `has_interest`, `is_recurring` (the form has a Repeat payment set) | loan or card |
| `add_lent` / `update_lent` | `has_due_date` | money lent |

Not yet named (only visible as `button_clicked` + `form_submitted`): account edit/archive/delete, loan or lent archive/delete,
holding edit/delete, recurring rule changes, support report submission, password reset, Google sign-in result.

## 5. Naming and privacy rules (enforced in code and by `tests/e2e/analytics.js`)

- Event names and property keys are **snake_case**; `Analytics.track` converts anything else (camelCase, hyphens), and also turns
  `-` into `_` in string values. Only PostHog's reserved `$pageview` keeps its `$`.
- Property values are **booleans, counts or fixed code names**. Never sent: amounts, balances, account/category/occasion/loan names,
  notes, search text, emails, asset symbols, dates, record ids, passwords, tokens.
- Web addresses are cut at `?` and `#` (sign-in links carry tokens there).
- Off: autocapture, session recording, surveys, feature flags, exception capture, cookies (browser storage is used), and
  everything on localhost or when the browser sends Do Not Track. The sample-data demo is silent except `demo_on` / `demo_off`.
- Person profiles are created only for signed-in people (`person_profiles: identified_only`); sign-out starts a new anonymous id.

## 6. How to use the data (starting points in PostHog)

- Activation funnel: `$pageview` (landing) -> `signed_up` -> `add_account` -> `add_budget` -> `expense_recorded`.
- Feature adoption: unique users per event in section 4; breakdown by `viewport`, `lang`, `env`.
- Usage heat: `button_clicked` broken down by `action` and `page`.
- Always filter `env = production` for real numbers (staging and previews share the project).

## 7. Backend events (not implemented; proposal)

Today the server side sends nothing to PostHog. If needed, in order of value:

1. `support_report_created`: a database trigger on `support_reports` (migration) posting to PostHog, or capture from the app (already visible as a form submit).
2. `signup_confirmed`: when Supabase Auth confirms the email (an Auth hook / Edge Function), because the browser may never see that moment (it happens on another device).
3. `price_lookup_failed` / API error counts from `api/index.py` (Vercel function) using the PostHog Python SDK with the server-side key.

Each needs a server-side secret or a hook and an updated privacy review, so none is built until you ask. A server-side event
must follow section 5 and use the account id as `distinct_id`.
