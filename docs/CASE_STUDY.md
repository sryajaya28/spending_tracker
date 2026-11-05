# Stiver: a case study

*Draft for the owner's review. Facts come from the project's own records (`context.md`, `docs/DECISIONS.md`, `learning.md`, the PRDs). Nothing here is a result we have not measured: there are no growth numbers yet.*

## The problem, and why I cared

I could not find an app that lets me manage income, spending, investments, debt and money I lent in a single place, with several currencies that move over time with real prices. Budgeting apps stop at spending. Investment apps stop at the portfolio. Almost all of them pick one currency and apply it to everything, so the moment you hold savings in one currency, shares in another and a loan in a third, the totals stop meaning anything.

So I built the tracker I wanted: a net worth tracker for individuals and, next, households. It answers a few plain questions. How much do I really save a month? Are my investments growing? What do I still owe and how fast is it going to zero? Who owes me? What am I worth?

## The thesis, and how I will know

**People need all of it in one place.** The headline metric tests that, not just activity: the share of new users who, within their first 7 days, set up at least two kinds of things beyond spending (an investment, a loan, money lent, or an account in a second currency). The initial target is above 25%, a guess I will revise with real data. If almost everyone only logs expenses, I built a budgeting app with extras, which is just as useful to learn.

## How it is built, and who built it

A static web app (plain HTML, CSS and JavaScript, no build step) on Vercel, with Supabase for sign-in and the database. It is designed, built and run by a team of AI agents (Claude): a Product Manager, a Designer, a Full-stack engineer, a Tech-Lead who reviews, integrates and releases, and QA. Each has a written role. I am the one human, and I approve at three gates: the requirements, the design, and the release. Nothing reaches production without my explicit release.

## Key decisions, and what I rejected

### 1. Each account keeps its own currency (not one global currency)
Every account and holding keeps its own currency; totals are converted at current exchange rates and market prices, so net worth moves with reality. I rejected a single app-wide currency because it is exactly the failure that made me build this. A related call: money decimals come from a fixed table, not from the browser, because a phone once reported two decimals for the Indonesian rupiah and showed values 100 times too small.

### 2. No bank syncing, for now
Bank API coverage in Indonesia is uneven, and holding bank credentials or tokens is a serious security responsibility for a product this small. I rejected it for now, not forever: the end goal is still fewer manual entries and more automated records, through other routes than bank or exchange syncing.

### 3. A web app before native apps
A static web app you can add to the Home Screen shipped faster, deploys by pushing, and let me change things daily. Native iOS and Android come later. I also deferred a framework (Next.js) until the code gets unwieldy.

### 4. Household access with a deliberate permission model
Families run money together, so the owner can invite people by email as an Editor (read and write) or a Viewer (read only). The rules I chose:
- Everyone sees the same data, and **every record shows who created or changed it**, in first name only, so everyone knows who did what with the money.
- An Editor can change only the transactions they created; the owner can change anything. I rejected "Editors can edit everything" because the point of the labels is trust between people, and silent edits of someone else's entries would break it.
- An Editor cannot delete an account or a category that other people's transactions use; the app says so and offers to archive instead.
- The rules are enforced by the database, not only hidden in the screen.
- An email that already has an account cannot be invited in the first version. I accepted that limit to avoid a real takeover risk.

### 5. A security review that changed the plan
A security review of the invite design found that if someone signs up with an email that has a pending invite, they could set the password before the real person confirms and sign in as that family member. I changed the rule: that sign-up now creates nothing and says "Check your invite email". Membership is only ever created from the invite link. I took it to the owner as a decision rather than assuming, and the cost is small (invited people must use their invite link).

### 6. Design first, with gates
UI work starts in Figma, in light, dark and phone width, and I approve the design before any code. I rejected "build it and show a preview" after a feature was built before it was designed and I corrected it.

### 7. Reviews only where the risk is
The expensive, different-model security review is only used for big changes that touch sign-in or the database. Everything else gets normal peer review and QA. This came from token cost: more review is not always better.

## What went wrong, and what changed

- **A regression reached production:** a small coding slip made every expense after the first show the wrong sign. We added a test that checks every row, not only the first, and a rule against passing functions with optional parameters straight into loops.
- **A feature was built before it was designed:** I corrected it, and "design first" became a rule.
- **Tests were sometimes pushed while red:** the checks now run before every push, and the whole output is read.
- **Approvals bypassed the shared workspace:** an agent's plan-approval prompt reached me in chat instead of the workspace. We moved every owner-bound ask through the Product Manager, blocked the plan and question tools for agents, and added a check line to every report.
- **The database tool's confirmation prompts timed out unseen:** agents could not apply some changes to staging. We moved those steps to the Tech-Lead's session, and to me for one small step, rather than weaken a check.
- **Costs grew with long sessions:** we added rules for fewer messages, pointer-style hand-offs and fresh sessions from a handoff note past a size limit.

## What is next

1. Household access to production, after my sign-off on staging.
2. Hardening the sign-in handoff (guessing limits, unreadable stored tokens).
3. Success-metric tracking: activation, weekly active users, retention.
4. Security basics before opening to the public.
5. Later: fewer manual entries, native apps, and a payment gateway (Xendit and Stripe) when there is something to pay for.

## What I deliberately did not build (yet)

Bank syncing, tax filing or advice, trading through the app, investment recommendations, and native apps.
