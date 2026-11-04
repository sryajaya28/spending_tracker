# Change files

Each change adds **one file here**, named `YYYY-MM-DD-short-name.md`, containing the changelog entry as one dated line
(`2026-11-04: **Title.** What changed and why, tests, branch.`). Do **not** edit `docs/CHANGELOG.md` directly: two agents
editing the same file conflict. The integrating agent folds these into `docs/CHANGELOG.md` with `node tools/fold_changes.js`
when it merges to `staging`.
