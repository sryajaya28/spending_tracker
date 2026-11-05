# Tier 2: Standard

**Typical work:** a new feature on existing data, flow changes, `app.js` logic, integrations that write no data.

**Load only:** this file, `docs/workflows/README.md`, `context.md` by section, `learning.md` for the area touched, `docs/FEATURE_TESTS.md`, `docs/ANALYTICS.md` if a button, form or outcome is added.

| Step | Who | Notes |
|---|---|---|
| Requirements | PM | Short requirements and acceptance checks (the owner's "Done when"); owner requirements gate |
| Design | Designer | Only if a new screen or interaction pattern (then Figma first, dark and phone width) |
| Build | Full-stack engineer | Cheaper model; feature branch; event tracking, tests, `regression_scenario.md` and `context.md` updated in the same commit |
| Review | Tech-Lead | Independent of the engineer; Tech-Lead merges to `staging` |
| QA | QA agent | Tests the feature plus the relevant e2e suite; retests **only the delta** after a fix |
| Staging | required | The owner signs off on staging |
| Release | batched | With other Tier 1/2 changes where possible; owner says "Release" once per batch |

**Escalate to Tier 3** on any trigger in README (a migration, a permission or role effect, financial values).
