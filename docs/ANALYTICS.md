# Analytics (PostHog Cloud EU): event tracking guide

Every new page, button, feature or interaction ships **with its event tracking**, in the same change, and the e2e test
covers it. This file is the checklist and the event catalog. Code: `prototype/analytics.js` (`window.Analytics`).

## Checklist for every new page / button / feature / interaction

1. **Clicks are tracked automatically** when the element has a `data-act="your_code_name"` (event `button_clicked`, property
   `action`). Give every new button a unique, descriptive `data-act` (snake or kebab case; it is sent as snake_case).
   A new button with no `data-act` is not tracked: add one.
2. **A new page (route)** is tracked automatically as `$pageview` with `page` = the first part of the address. Check the page
   name is meaningful and holds no id or date.
3. **A new pop-up** is tracked automatically (`dialog_opened`, `form` = its `data-form`); give every form a `data-form`.
4. **A new business outcome** (something was created, changed, deleted or recorded) gets a **named event**, fired right before
   `save(); close(); render();` in the success path: `Analytics.track('add_x' | 'update_x' | 'delete_x' | 'x_recorded', { ...flags })`.
5. **Naming:** snake_case for event names and property keys; verbs first for setup (`add_category`, `update_budget`,
   `delete_transaction`), past tense for money events (`expense_recorded`). `Analytics.track` converts anything else
   to snake_case, but write it right the first time.
6. **Properties: only booleans, counts and fixed code names** (`type`, `side`, `source`, `has_fee`). **Never** names, notes,
   amounts, emails, symbols, search text, dates or record ids. When unsure, leave it out.
7. **Add it to the test** (`tests/e2e/analytics.js`): drive the new element and assert the event and its properties, and that
   nothing private leaked.
8. **Update the docs in the same commit:** the catalog below, `context.md` changelog, `regression_scenario.md` (section 15).
9. Staging first (events carry `env = staging`), then production, like every other change (`docs/DEV_WORKFLOW.md`).

Silent by design: localhost, the sample-data demo (except `demo_on` / `demo_off`), and browsers with Do Not Track.

## Event catalog

The full reference (every `action` value, form kind, property and the backend status) is `docs/EVENTS.md`; update it with this table.

Every event also carries `page`, `lang`, `theme`, `viewport` (mobile/desktop), `env` (production/staging), `app`.
Person properties: `currency`, `language`, `theme`. The person id is the account id (no email).

| Event | Properties | When |
|---|---|---|
| `$pageview` | `page` | a page (route) is opened; `landing` when signed out |
| `button_clicked` | `action`, `element`, `in_dialog`, optional `view`/`tab`/`side`/`type`/`kind`/`route`/`preset` | any element with `data-act` |
| `nav_clicked` / `link_clicked` | `to` / `host` | internal navigation link / external link |
| `dialog_opened` | `form` (`info` for read-only pop-ups) | a pop-up opens |
| `form_submitted` | `form`, `edit` | a form is submitted (attempt; the outcome events below say it worked) |
| `setting_changed` | `setting` (currency, period, ai, language), `value` | a setting changes |
| `filter_changed` / `period_changed` / `range_changed` | `filter`+`active` / `all_periods` / `range` | list filters, period picker, chart range |
| `signed_up` / `signed_in` | `confirmed` / none | account created / login |
| `onboarding_skipped` / `onboarding_completed` | none | first-run flow |
| `demo_on` / `demo_off` | none | sample data switched |
| `expense_recorded` / `income_recorded` | `type`, `payment_source` (account/stablecoin/debt), `has_category`, `has_occasion`, `is_recurring` | a transaction is added |
| `update_transaction` / `delete_transaction` | same / `type` | edit / delete |
| `transfer_recorded` / `transfer_edited` | `has_fee`, `is_recurring`, `involves_investment_cash` | transfer between accounts (or with an investment Cash balance), added / edited |
| `delete_transfer` | none | a transfer deleted |
| `invite_sent` / `invite_resent` / `invite_revoked` | `role` (editor/viewer) / none / none | the owner invites, resends or cancels an invitation (never the email) |
| `invite_accepted` | `role` | the invitee finished the Join page and is signed in |
| `member_role_changed` / `member_removed` / `household_left` | `role` / none / none | household admin actions and a member leaving |
| `login_deleted` | none | a person without access chose Delete my login |
| `cash_deposited` / `cash_withdrawn` | `has_fee`, `is_cross_currency` | Deposit / Withdraw on an investment Cash balance (Portfolio pop-up) |
| `trade_recorded` | `side` | buy/sell of an asset |
| `debt_payment_recorded` | `kind` (loan/lent), `is_recurring` | loan payment / lent repayment (`is_recurring` when it was set to repeat) |
| `add_category` / `add_sub_category` / `update_category` | `type`, `source` (settings/quick_add) | categories |
| `restore_category` | `type`, `level` (category/sub_category) | an archived category brought back (Settings > Categories > Archived) |
| `add_account` | `type` | new account |
| `add_budget` / `update_budget` / `delete_budget` | `scope` (overall/category) | budgets |
| `add_occasion` / `update_occasion` | `has_budget`, `has_dates` | special occasions |
| `add_debt` / `update_debt` | `has_interest`, `is_recurring` (a repeating payment is set) | loans |
| `add_lent` / `update_lent` | `has_due_date` | money lent |
| `add_asset` | `funded` | investment asset added |

## Setup facts

Dashboard: "Stiver key flows" https://eu.posthog.com/project/334082/dashboard/1083794 (production only). When you add a feature with a new outcome event, add or extend a tile there.

PostHog Cloud EU, project id 334082, token `POSTHOG_KEY` in `prototype/config.js` (public). Browser traffic goes through
`/ingest` (Vercel rewrite to `eu.i.posthog.com`). SDK vendored in `prototype/vendor/posthog.js`. Privacy rules are in the
header of `analytics.js` and in `prototype/privacy.html`; do not weaken them.

Click actions added with the sign-up agreement: `agree_terms` (tick box) and `toggle_password` (show / hide), both through `button_clicked`.
