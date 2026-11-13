# Learning: Release discipline: push, staging, production

Part of `learning.md` (index). Lessons above the line were carried over from earlier projects (starter kit); add this project's own below it, and the dated story to the Session log in `learning.md`.

- **Never push with a failing test.** Chain commands with `&&`, never `;`, and read the whole output. If a test fails because the test is outdated, fix the test first.
- **Code that needs a database change must not reach production before the migration is applied.** A client that writes a new column breaks saving for everyone. Order: migration on staging, code on staging, migration on production, code on production. Migrations must be backwards compatible with the version still running.
- **Merging to `main` deploys to production.** Say what you could not verify (live site, a real phone, real third-party services, real email) instead of implying it works there.
- **Do not push to a release PR after its checks started.** Every push restarts them. Fold the changelog, run regression, open the PR, then stop committing. A late fix is the next release unless it is a hotfix.
- **Hosting config (rewrites, headers, CSP) is only proven on a real deployed URL.** A stubbed route passed while the real rewrite missed a trailing slash and no analytics event ever arrived. After such a change, curl the exact path and method the client uses on staging and confirm the data reaches its destination.
- **Look at every screenshot before sending it.** Wait for animations to finish before capturing.
- When "Release" is said, the release record (`docs/RELEASES.md`) and the `docs/COSTS.md` row are part of the release: same turn.
- A Tier 1 batch needs no regression run and no production smoke test: check the tier file before listing release steps, do not offer extra ceremony.
- Tier 3 ships alone so a problem can be traced and rolled back. Name the rollback (previous merge sha; a down script for a migration) before the release, not after.
- Never pass a function with optional parameters straight to `.map`/`.forEach` (the index became an argument and shipped a wrong sign to production): write `.map((t) => fn(t))`, and test every row, not only the first.
- A branch based on an old `staging` needs a rebase before its PR; a conflicted PR gets no CI run at all (the workflow simply never appears). Fetch `origin/staging` before starting.
- If CI stays queued for hours, say so; the owner may merge with the admin bypass after the staging regression passed. Never fake a green.

---
