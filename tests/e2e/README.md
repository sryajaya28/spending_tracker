# Browser tests

End-to-end checks that drive the real app in headless Chromium (Playwright) with `fake_supabase.js` standing in for
Supabase, so nothing touches a real account or database.

```bash
bash tests/e2e/run_all.sh            # everything
bash tests/e2e/run_all.sh transfer   # one test
```

What they cover: sign-in/up flows, landing page, saving only changed rows, wallets (edit, archive, restore, delete),
transfers with fees and currencies, budgets and occasions, special-occasion tagging, quick category add, sample-data
demo mode, language and dark mode (saved to the profile), iPhone-style currency decimals, the Content-Security-Policy,
and the email-confirmation auto sign-in.

`record_demo_tour.js` is not a test: it records the landing-page demo video (see `context.md`).
`idcrawl.js` lists any English text left on screen when the app is in Indonesian.
Outputs (screenshots, recordings) go to `tests/e2e/out/` and are gitignored.
