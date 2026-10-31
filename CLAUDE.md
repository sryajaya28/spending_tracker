# Instructions for assistants working on Stiver

1. **Read `context.md` before doing anything.** It is the source of truth for the project's architecture, services,
   decisions and open items. If it disagrees with the code, trust the code and fix the file.
2. **After doing anything, update `context.md` in the same commit** (change the affected sections and add a dated line to
   its Changelog). Also update `README.md` when the change affects what it describes, and `docs/NEXT_STEPS.md` when
   priorities or known gaps change.
3. Never commit secrets. `context.md` and the README say where secrets live, never what they are.
4. Run `bash tests/e2e/run_all.sh` before pushing UI or data-layer changes. Pushing to `main` deploys to production.
