# Goals: prototype brief for the Designer (not a PRD)

Status: exploration. The owner asked (2026-11-05, in the PM chat) to **visualize the proposal before any PRD**: "Can you start with prototyping first before PRD? I want to visualize your proposal. Include all of the UI/UX implications in other pages or flows". Nothing here is approved for build. After the owner has seen the prototype, the PM writes the PRD from what survives. Tier 3 (new tables, household roles, money): full process, Figma first, ships alone.

Where: Figma file "Stiver", new section **"Feature - goals (prototype)"**. Build from the Library components and variables (docs/FIGMA.md). Every screen in **light, dark and phone width (390)**, plus desktop for the main ones. Link the frames into a **clickable prototype** with the flows listed below. Reply to the PM with the Figma link and screenshots; the PM talks to the owner.

## Principles (owner's, decided in chat 2026-11-05)
1. **Entry point:** goals live inside **Budgets** (a switch at the top: Budgets | Goals) plus a **Goals card on Overview**. No new bottom tab. A small "2 goals" chip on Savings and Investment account cards in Portfolio links to the same place.
2. **No hurdles:** the app never asks the user to approve or decide when a spend touches goal money. It acts by itself and **shows clearly what it did**.
3. **Investments are in from the first version.**
4. A goal is **not extra money**: net worth and Total Balance do not change because of goals.

## The model to visualize
A goal has a name, icon, target amount, currency (can differ from the accounts funding it), optional target date, and **funding sources** of two kinds:
- **A dedicated pocket or account** (a bank vault such as a Bank Jago "Kantong", or a separate savings account): the whole account balance is the goal, automatically.
- **A set-aside from a shared account:** a **fixed amount** from a savings account, or a **share (%) of the account value** from an investment account (value moves with the market; shares in one account cannot exceed 100%). Account level only, not per holding.

Creating a goal asks one question: **"Is this money in its own pocket or account?"** Yes: pick or add the account. No: pick the account(s) and the amount or share.

**Spending rules (automatic, no prompt):**
- From a shared savings account: the spend comes out of the account's **free money first**; if it is bigger than the free money, the rest comes out of that account's goals **in proportion to their size**. Editing or deleting the transaction puts the goal amounts back.
- From a dedicated account: the goal falls by the same amount, because that is where the money is.
- From an investment account (a sale): shares move with the value; nothing to deduct.
- Deposits and income go to free money; a goal grows only when someone adds to it (or when money goes into its dedicated account).

## Screens and flows to design (all states, light/dark/phone)
**A. Entry and overview**
1. Budgets page with the Budgets | Goals switch (both states).
2. Overview Goals card: top 2 to 3 goals with progress; empty state "Set your first goal" (also shown to a new account).
3. Portfolio Savings and Investment account cards: "Rp 120M · Rp 90M for goals · Rp 30M free" line and the "2 goals" chip; **account breakdown sheet** (stacked bar: each goal + free); dedicated-account tag; shortfall state (goals drained) in amber.

**B. Goals list and detail**
4. Goals list: progress bars, amount saved of target, date status (on track / behind / no date), total set aside; empty state; completed and archived section.
5. **Create goal flow** (3 to 4 steps): name, icon, target, currency, optional date; the pocket question; then (a) dedicated: pick or add account; (b) shared savings: pick accounts + amount with free-money check; (c) investment: share slider/percent with the value shown in the goal currency. Review step.
6. Goal detail: progress ring/bar, funding sources (each with account, amount or share, market-linked marker for investments), history (contributions, spends from the goal, who did it in a household), "needed per month" if a date is set, actions: add money, change funding, edit, mark done, archive.
7. Add money / change funding sheets for both source kinds; transfer into a dedicated account shows up on the goal automatically.
8. Edge states: goal reached (done state and "release the set-aside money"), over-funded, date passed, goal currency different from the account (converted amount with the rate note), funding account archived or deleted (what happens to the goal), investment value dropped (progress down, plain wording, no alarm).

**C. Implications elsewhere**
9. **Transactions list:** a chip under a row only when a spend touched a goal ("🎯 Holiday −Rp 1M", "🎯 2 goals −Rp 3M", "From goal: Holiday"); other rows unchanged. Transaction detail lists each goal and amount; a filter "Used goals"; search.
10. **Add expense / transfer / invest-sell forms:** an informational line under the account field when the account has goals ("Rp 30M free; anything above comes from your goals"), no extra question or button.
11. Edit and delete transaction: wording and behavior when it had goal draws (goal amounts restored).
12. Portfolio net worth and Overview Total Balance: show that goals do not change them (tooltip wording).
13. Household: goals are shared. **Viewer**: no add/edit controls anywhere (same rule as today, no empty bottom-bar slot). **Editor and owner**: who creates and edits goals (propose: owner and Editors, with a "created by" label, like other records). History rows show first name.
14. Sample-data (demo) mode: seeded goals that show every state above.
15. English and Bahasa Indonesia strings (list them), money formats with the 7 currencies, long names, large numbers, phone width.

**D. Analytics (names only, for the later PRD):** goal_created, goal_funding_added, goal_completed, goal_archived; a screen/step for each flow above.

## Deliverable and questions
- Figma section with the frames above, a clickable prototype of: create goal (both paths), see it on Overview, spend from an account that has goals and see the chip, view the account breakdown, Viewer variant.
- Flag **at most one batched list of design questions** for the owner (via the PM) with a recommended default for each; do not ask separately.
- Not in scope for the prototype: build, code, the PRD, the data model.
