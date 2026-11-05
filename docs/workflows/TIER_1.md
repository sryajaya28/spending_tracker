# Tier 1: Fast Track (presentation only)

**Eligible:** text and copy, spacing and styling (CSS), icons and images, translations (`i18n*.js`), docs. Nothing that changes data, logic or what any user can access. `app.js` is never Tier 1.

**Load only:** this file, `docs/workflows/README.md` (routing and escalation), `docs/changes/README.md`. Nothing else.

**Flow**
1. The Tech-Lead implements on a feature branch and self-tests locally.
2. Open a PR. CI (when built; until then the Tech-Lead runs `node tools/affected_tests.js`) runs the e2e suite; a red run blocks the merge, no override.
3. Take screenshots from the **preview deploy** (phone and desktop, light and dark, both languages if text changed), not from local.
4. State in the PR that no logic, data or access path changed (CI checks this when built: allowed paths only, diff-size cap, no new `data-act` handler). If untrue, it is Tier 2.
5. Merge to `staging` (no per-change owner wait). The owner reviews the batch of screenshots once and approves one production release per batch (for example weekly, or at 5 to 10 changes).

**Replaces the dropped steps:** smoke agent → screenshots of the real preview; regression agent → e2e in CI; QA agent → owner review of screenshots; separate code review → the path rule keeps the change to presentation files.

**Gap:** the Tech-Lead reviews its own work. Acceptable only because Tier 1 cannot touch data or money, CI catches breakage and the owner sees the result. If e2e coverage of an area is thin, add tests before using Tier 1 there.

**Docs:** a change file only. Event tracking (CLAUDE.md rule 5b) still applies to anything that adds a button or form (then it is not Tier 1).

**Releasing a Tier 1 batch (owner, 2026-11-05):** no regression run and no production smoke test. CI's e2e run and the owner's review of the preview screenshots are the gates (they replace the regression and smoke passes). After the owner says "Release": merge `staging` into `main`, then only check that the site answers 200 and serves the new build stamp. `tools/gates.js` and `tools/release.js` still apply the old docs-only rule to `prototype/` changes: for a Tier 1 batch, say so in the release PR and skip those steps; teaching the tools about tiers is open (docs/NEXT_STEPS.md item 0).
