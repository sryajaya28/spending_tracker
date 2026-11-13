# __PROJECT__: project context (source of truth; if this file and the code disagree, trust the code and fix this file)

Keep it short: current state only. History goes to `docs/CHANGELOG.md` (through change files), lessons to `learning.md`. `node tools/doc_budget.js` fails when the start-up files grow too large.

## 1. What this is
<one paragraph: the product, who uses it, what it must never get wrong>

## 2. How the owner works
See `docs/learning/owner.md`. Add project-specific preferences here (wording, formats, look).

## 3. Features (current)
<one line per feature, with the file that holds it; details in `docs/FEATURE_TESTS.md`>

## 4. Architecture and repo map
<stack, how a request flows, folders; keep source files under 600 lines and list feature -> file in `docs/MAP.md`>

## 5. Data model
<tables, who can read and write each (per role), migrations folder and numbering>

## 6. Business rules the code encodes
<the rules a reviewer must not break: money, rounding, signs, dates, roles>

## 7. Services, accounts and identifiers (no secrets)
| Service | What for | Identifier | Where its secret lives |
|---|---|---|---|
| Hosting | staging `__STAGING_URL__`, production `__PROD_URL__` | | |
| Database | staging and production are separate projects | | |

## 8. Security posture
<headers, CSP, row-level security, rate limits, what is public on purpose (publishable browser keys)>

## 9. Deployment and testing
Branches: `feature` -> PR -> `staging` -> PR -> `main` (production). Tests: `bash tests/run_all.sh`. Release: `docs/DEV_WORKFLOW.md`.

## 10. Open items
`docs/NEXT_STEPS.md`.
