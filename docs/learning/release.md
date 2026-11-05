# Learning: Release discipline: before you push, tests, staging, production

Part of `learning.md` (index). Add a line here when a mistake in this area happens; add the dated story to the Session log in `learning.md`.

- **Never push with a failing test.** Twice a push went out while a test was red (dropdown group test, sample banner test)
  because the command chain used `;` instead of `&&`, or the output was not read. Run `bash tests/e2e/run_all.sh`, read
  the whole output, push only when every line is `PASS`. If a test fails because the test is outdated, fix the test first.
- **A regression shipped to production**: `.map(txnRow)` passed the array index as the function's second argument
  (`txnRow(t, loanView)`), so every expense after the first row showed `+`. Never pass a function with optional
  parameters straight to `.map` / `.forEach`; write `.map((t) => fn(t))`. Add a test that checks every row, not only the first.
- **Code that needs a database change must not reach `main` before the migration is applied.** `cloud.js` writes new columns
  on every save, so an unapplied migration breaks saving for everyone. Commit to the session branch only, hand the SQL to the
  owner, verify with a read query, then push to `main`.
- **Pushing to `main` deploys to production.** Say what you could not verify (live site, real iPhone, real Yahoo/Finnhub
  prices, real Supabase email) instead of implying it works there.
- The first manual Vercel deploy failed (made-up commit sha, then a free-plan limit). Use the real commit sha; check the plan.
- **Look at every screenshot before sending it.** Several previews were sent unseen and had layout bugs (overlapping amounts,
  chevron wrapping, transparent popover mid-animation). Wait for animations to finish before capturing.
- **Hosting config (rewrites, headers, CSP) is only proven on a real deployed URL.** A stubbed network route passed while the `/ingest/:path*` rewrite missed `/ingest/e/` (trailing slash) and no analytics event ever arrived. After such a change, curl the exact path and method the client uses on staging and confirm the data shows up at its destination.
- **Do not push to a release PR after its checks started.** Every push restarts them (Release 16: three extra commits, one run that started late). Fold the changelog, run regression, open the PR, then stop committing (see `docs/workflows/README.md`, Release hygiene).
- **A Tier 1 release does not need regression or a production smoke test** (docs/workflows/TIER_1.md). Offering them after the wallet-icon change followed the old tools/gates.js rule instead of the owner-approved plan; the owner caught it. Check the tier file before listing release steps.
