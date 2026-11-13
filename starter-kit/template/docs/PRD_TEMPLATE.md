# PRD: <feature name>   (owner brief date: ...)

Keep it to two pages. Short answers are fine; "owner to decide, recommended: X" is valid.

1. **Problem and goal** (one paragraph, owner's words first; who is the user, what hurts today).
2. **Scope**: in / **out** (what must not be touched).
3. **User stories**: As a <user> I can <do> so that <why>.
4. **Acceptance checks** (numbered, testable by someone who has not read the code; QA writes test cases from exactly these):
   1. Given ... when ... then ...
5. **Edge cases and rules** (empty state, errors, limits, sign/currency, dark mode, phone width, Indonesian text, offline, existing data).
6. **Data and privacy**: what is stored, migrations needed (backwards compatible?), what must never go to analytics.
7. **Analytics**: events to add (snake_case; `docs/ANALYTICS.md`) and the success metric with a target.
8. **Design notes**: which screens, library components to reuse; designer fills the Figma link.
9. **Open questions**: one batched list, each with a recommended default.
10. **Release plan**: lane, migrations, how we will know it worked (PostHog query).

Status line: `PRD v1 | owner approved: <date or pending> | Figma: <link> | Branch: <name> | QA report: <link or pending>`
