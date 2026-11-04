# Working with more than one agent

Rules so two agents (or sessions) on Stiver do not collide. The owner can override any of them in plain words.

1. **Roles (owner, 2026-11-04): Developer 2 is the integrator; Developer 1 builds on feature branches.** An agent that is not sure whether it is Developer 2 asks the owner
   before merging to `staging`. Only the integrator merges into `staging`, runs `node tools/fold_changes.js`, releases to `main` and runs the
   smoke test. Other agents work on `feature/<name>` branches only, rebase on the latest `staging`
   (`git fetch origin staging && git merge origin/staging`), run the affected tests plus `bash tests/e2e/run_all.sh`, then tell the
   owner "ready: <branch>, tests pass, design link, steps". Explicit owner instructions such as "push to staging directly" or a
   hotfix go before this rule; whoever does it tells the other agent.
2. **No shared edit hotspots.**
   - The service worker cache name is stamped at deploy (`tools/stamp_sw.js`, run as the Vercel build command): never edit it.
   - The changelog entry is its own file in `docs/changes/` (see its README); the integrator folds them into `docs/CHANGELOG.md`.
   - `context.md` is edited in the section a change affects, not appended to; keep edits small.
3. **Split by area.** Say which part of the app you are working on before you start; avoid editing the same large file
   (`prototype/app.js`) region at the same time as another agent. If you must, keep the change small and rebase often.
4. **Hand off in writing.** When you stop with work in progress, add a short "state of my branch" note under
   `context.md` section 16 (done / untested / blocked), so the next agent does not re-read the transcript.
5. **Reviewer role (optional).** One agent can review another's branch against the Figma design and the request before it is
   merged; it comments, it does not push to the other agent's branch.
