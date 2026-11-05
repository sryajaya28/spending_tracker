# Tier 3: Full

**Typical work:** migrations, RLS, auth, sharing/household, financial calculations, imports, security configuration, anything role-dependent. Today's full process, unchanged; Release 15 is the model (it is where reviews and real-account QA caught real access bugs).

**Load:** this file, `docs/workflows/README.md`, `docs/AGENTS.md` rules 5-9, `docs/DEV_WORKFLOW.md`, the PRD and technical design of the feature, `learning.md` (data/RLS and release areas).

1. **PM:** full PRD with edge cases; owner requirements gate.
2. **Designer:** required, Figma first (dark mode and phone width).
3. **Full-stack engineer:** a written technical design first, then the build (strongest model).
4. **Tech-Lead review on a different model** with a security checklist (RLS on every table, who can read/write per role, definer functions, secrets, rate limits, fail-closed behaviour). No separate Security agent and no PM release approval: both add passes, not protection.
5. **QA:** full regression plus manual scenarios in `regression_scenario.md`, **with real accounts** for anything role-dependent (a second login per role). Retests only the delta after a fix, but always on the final build.
6. **Staging:** migrations applied to staging first; the owner signs off.
7. **Release:** its own release, never batched. Migrations with `DROP POLICY` or other destructive SQL cannot be applied through the agent database tool (the confirmation prompt times out): use the CI migration job when built, otherwise a single `begin/commit` file the owner runs in the dashboard SQL editor, verified read-only afterwards. Production smoke test; the exact release contents are recorded in `docs/RELEASES.md`.
