# One-time setup for a new project (owner, about an hour)

Things only you can do: a session cannot change repository settings, create accounts or see secrets. Do 1 to 4 before the first session, the rest when the project needs them. Tick them off in the new repository's `docs/NEXT_STEPS.md`.

## 1. Repository and branches (GitHub)
1. Create the repository (private unless it must be public). With route C in `README.md`: *Use this template*.
2. Two long-lived branches: `main` = production, `staging` = everything approved but not released. Sessions only ever work on short branches off `staging`.
3. *Settings > Rules > Rulesets*, one ruleset for `main` and `staging`: require a pull request, require the status checks `tier` and `test` (they appear after the first PR has run), block force pushes. Keep yourself on the bypass list: it was needed once when GitHub Actions stayed queued for six hours.
4. In the same ruleset tick **Automatically request Copilot code review** (the reviewer from another vendor: advisory comments, CI stays the gate). It reads `.github/copilot-instructions.md`.
5. *Settings > Environments*: create `staging` and `production`; give `production` a required reviewer (you). That is the approval click for production migrations.

## 2. The Claude environment (claude.ai/code)
1. One environment per project, named after the repository.
2. **Connectors: only GitHub and the database** (plus Figma for design sessions). Every extra connector is re-read on every turn. Turn the rest off at https://claude.ai/customize/connectors or leave them out of the environment.
3. **Network: add the staging and production hosts** to the allowed domains, or release checks and smoke tests cannot reach the site.
4. **Secrets** (environment variables of the environment, never the repository): `SMOKE_STAGING_PASSWORD`, `SMOKE_PROD_PASSWORD`, any API keys the tools need.
5. Start every task as a **new session** on the mid-size model, on branch `staging`. Never return to an old session; never change model inside one.

## 3. Hosting (Vercel or similar)
1. Import the repository. Production branch `main`.
2. Add the staging domain and tie it to the `staging` branch (*Domains > Edit > Git branch*). Every PR gets a preview link by itself.
3. Environment variables per environment (production / preview). Staging and previews point at the **staging** database, only production at the production one.
4. Know where *Instant Rollback* is before the first release.

## 4. Database (Supabase or similar)
1. **Two projects**: `<name>` (production) and `<name>_staging` (test accounts only, email auto-confirm on). Never share one database between staging and production.
2. Note both project references in `context.md` section 7 (identifiers are not secrets; keys and database passwords are).
3. Repository secrets for the migration job (*Settings > Secrets and variables > Actions*): `SUPABASE_ACCESS_TOKEN`, `DB_URL_STAGING`, `DB_URL_PROD`.
4. Row-level security on every table from the first migration. Migrations go to staging first, are never edited once applied, and production gets them only inside a release.
5. Check backups and point-in-time recovery on the plan before real users.

## 5. Smoke-test accounts (when sign-in exists)
One account per environment, named "SMOKE TEST (do not delete)", flagged in its metadata, no real inbox, password only in the environment secrets from step 2. Tests create records marked `SMOKE <timestamp>` and delete them again.

## 6. Design (Figma), when the project has screens
One file per project. A library page with colour, spacing and type **variables** (dark mode as a variable mode, so every dark screen is nearly free) and components; one section `Feature - <short-name>` per feature with the request, open questions and status. Put the link in `CLAUDE.md` (`install.sh --figma <url>`).

## 7. Before real users
Analytics with a first-party proxy path and an event catalog (`docs/ANALYTICS.md`); error monitoring; uptime monitor; rate limits per address with CAPTCHA; terms and privacy pages; a load test before a public launch. The list is pre-filled in the new repository's `docs/NEXT_STEPS.md`.
