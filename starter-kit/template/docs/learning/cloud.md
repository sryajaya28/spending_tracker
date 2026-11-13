# Learning: Cloud sessions and their tools

Part of `learning.md` (index). Lessons above the line were carried over from earlier projects (starter kit); add this project's own below it, and the dated story to the Session log in `learning.md`.

- `gh` may say "token invalid" and still work through the proxy for some calls: test the real call before assuming. `gh api -f` turns a GET into a POST, which the proxy refuses. Use the GitHub connector for pull requests.
- Node `fetch` bypasses the session proxy; scripts that call the network use `curl`.
- The session can reach only allowed hosts. If the live site is blocked, never loop waiting for it: verify through the host's deployment status for the merge sha and say the live site was not checked. Add staging and production hosts to the environment's allowed domains when the project starts.
- Repository settings (branch protection, rulesets, the reviewer bot, secrets) are owner actions; the agent cannot change them. Give exact click paths.
- Confirm the `ci` workflow run itself finished before saying CI is green: a wait script once counted only the host's deploy checks while the real run was still queued.
- A detached HEAD at session start needs a branch before committing.
- Running tests can rewrite caches and screenshots inside the repo: check `git status` before the final commit.
- A script's `--help` may not print help (one folded the changelog instead): read the file header.
- Session token counts can be summed from the session's own usage record; dollars need a rate the owner supplies. If no usage record is visible, write "not recorded" in `docs/COSTS.md`, never a guess.
- A connector prompt that needs the owner's click may never reach them: do not wait on it, hand over the action in chat.

---
