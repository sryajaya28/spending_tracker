# Starter kit: everything learnt so far, ready for the next project

Copy this folder's contents into a new repository and the project starts on day one with the workflow, tools, templates and lessons that took the first project (Stiver) weeks and about $470 of AI cost to find. Nothing here is specific to that app.

## Use it (pick one)

**A. From a Claude session in the new repository (easiest).** Send this as the first message:

> Set up this repository from my starter kit. The kit is the `starter-kit/` folder of `sryajaya28/spending_tracker` (branch `main`). Clone it to a temporary folder, read `starter-kit/BOOTSTRAP.md` and follow it. Project name: <name>. What it is: <one sentence>.

**B. On your own computer** (both repositories checked out next to each other):

```bash
bash spending_tracker/starter-kit/install.sh my-new-repo --name "My App" --stack
```

**C. As a GitHub template (best once you start a third project).** Put this folder in its own repository, tick *Settings > Template repository*, and create every new project with *Use this template*. `SETUP.md` step 1 has the details.

The installer never overwrites a file, fills in the project name, addresses and folders, and lists what is still a placeholder. Run it again later with more flags (`--prod`, `--staging`, `--figma`) to fill those in.

## What is inside

| Path | What it is | Who reads it |
|---|---|---|
| `README.md` | this page | you |
| `SETUP.md` | one-time setup of the services, click by click: GitHub branches and rules, reviewer bot, hosting, two databases, secrets, smoke accounts, the Claude environment, Figma, analytics | you (about an hour, once per project) |
| `BOOTSTRAP.md` | what the first session in a new repository does, step by step, and how it proves the setup works | the first session |
| `PLAYBOOK.md` | how the work runs day to day: the words you say, the tiers, the release, the cost rules and the numbers behind them, and what was tried and dropped | you and any session that asks "why" |
| `install.sh`, `kit.test.sh` | the installer and its self-test | sessions |
| `template/` | the files copied to the new repository's root: `CLAUDE.md`, `context.md`, `learning.md` plus eight lesson files, tier workflows, task / PRD / request / ready-report templates, release and smoke-test runbooks, CI, reviewer guidance, PR template, permission settings and the tools | every session, a little at a time |
| `stack-supabase-vercel/` | optional pack (`--stack`): release, migration, screenshot, smoke-test and browser-test tools from the first project; `README.stack.md` says which run as they are and which to adapt | sessions on that stack |

## Keeping it alive
- **Lessons flow back.** Every project's `docs/KIT.md` tells its sessions to send a lesson that would help any project back to `template/docs/learning/` here. Ask for it when something goes wrong: "add that to the starter kit too".
- **Updates flow out.** `bash starter-kit/install.sh <repo> --update` adds what a project is missing and lists files that differ, without overwriting.
- After any change to the kit, run `bash starter-kit/kit.test.sh` (installs into a throwaway folder and runs the tools).
- Bump `kitVersion` in `template/tools/kit.config.json` when the kit changes in a way projects should pick up.

This repository is public, so the kit is too. It holds no secrets and must never hold one.
