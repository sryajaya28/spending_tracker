# Documented exceptions to docs/team-protocol.md

Each exception is narrow, written down, approved by the owner in chat, and changes only when the owner changes this file.
Agents may not edit this file.

## E1. Production smoke test

Protocol rule: agents never hold production credentials or touch production hosts.

Exception: after a release the assistant may run the existing production smoke test exactly as `docs/SMOKE_TEST.md`
describes: `tests/smoke/smoke.js` against `https://stiver.io`, signing in with the dedicated smoke account
`smoke.production@stiver.io`, whose password is the environment secret `SMOKE_PROD_PASSWORD`.

Limits:
- Only that script and that account. The Bash guard (`scripts/guard-prod.sh`) allows the exact command line from
  `docs/SMOKE_TEST.md` and nothing else that matches a production marker. `tests/phase0.sh` tests this.
- The password stays in the environment secret. It never goes in a file, log, brief, commit or chat message.
- No production deploys, no migrations, no queries or writes against the production database, and no use of the Vercel
  or Supabase connectors for production.
- The only production writes allowed are the two records the smoke script creates (marked `SMOKE`) and deletes again.
- If the guard blocks a production command, stop and ask the owner. Do not edit the guard, the markers or this file.

## Open points for the owner (not exceptions yet)

- Who merges into `staging` and `main`. The existing workflow lets the assistant merge after approval; the team protocol
  says agents never merge their own PRs. Until the owner decides, the stricter rule applies: the owner merges.
- No automatic production deploy from `main`. Needs a Vercel setting changed by the owner, then a protected release
  workflow. Not part of this change.
