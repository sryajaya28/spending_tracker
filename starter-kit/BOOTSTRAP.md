# Bootstrap: what the first session in a new repository does

For the session. Do the steps in order; stop and report after step 7. Budget: one session, under 60k tokens. Do not read the kit's other guides unless a step says so.

**Ask once, first.** In ONE message ask the owner for whatever is missing from this list, each with a default: project name; one sentence on what it is; app folder (default `app`); stack (default: the same as the first project, static web app + Supabase + Vercel, so `--stack`); production and staging addresses (default: fill in later); Figma file link (default: later); who the users and roles are; what the product must never get wrong (money, privacy, access).

1. **Install.** `bash <kit>/install.sh . --name "<name>" --app-dir <dir> [--stack] [--prod … --staging … --figma …] --kit-home "<where the kit lives>"`. Read its output: files kept, placeholders left.
2. **Branches.** `main` (production) and `staging` must both exist; create `staging` from `main` if it does not. Work on a branch off `staging`.
3. **Fill `context.md`** sections 1, 4, 7 and 9 from the owner's answers and the code that exists. Leave a section as a one-line "not built yet" rather than inventing content. Put the one sentence about the product at the top of `.github/copilot-instructions.md`.
4. **Fit the tier rules to this code.** Read `tools/kit.config.json` (`tierRules`). For every folder in the repository run `node tools/path_tier.js --files <a real file>` and check the answer is right: anything touching data, access, sign-in, money or security config must come out 3; app logic 2; presentation and docs 1. Edit the rules, add a line per new rule to `tools/path_tier.test.js`, and update the table in `docs/workflows/README.md` in the same commit.
5. **Stack pack (only with `--stack`).** Go through the table in the kit's `stack-supabase-vercel/README.stack.md`. For each "adapt" file: adapt it now if the thing it needs exists, otherwise delete it and add a line to `docs/NEXT_STEPS.md` ("build smoke test when sign-in exists"). Never leave a script that fails or tests another app's screens.
6. **Tests.** Put the project's test command into `tests/run_all.sh` (it already runs the tool tests). `bash tests/run_all.sh` must print only PASS lines. Remove mentions in `CLAUDE.md` and the tier files of tools this project does not have (`grep -rn "tools/" CLAUDE.md docs/workflows | grep -v` the files that exist).
7. **Prove it.** `node tools/doc_budget.js` passes; `grep -rn "__[A-Z_]*__" . --include=*.md` lists only placeholders the owner still has to supply; open the PR into `staging` and wait with `node tools/ci_wait.js <pr>`: the `tier` job must label the PR and the checks must be green.
8. **Report** to the owner: what was installed, what was deleted and why, the placeholders left, and the list of owner actions from the kit's `SETUP.md` that are still open (branch rules, reviewer bot, secrets, allowed hosts), with the exact click path for each. Add the first row to `docs/COSTS.md` and the Session log line in `learning.md`.

Not part of the bootstrap: building features, creating cloud projects, buying domains, anything in production.
