# Stiver Workspace (the shared message feed, a Claude artifact)

URL: https://claude.ai/artifact/SK9TLRLSf8dyyg5EnCvZTt (private to the owner). A Slack-like view of everything the agents do, with every item that needs the owner's decision pinned in a "Needs you" tray at the top. It is a **mirror and an inbox**: the PM still sends the owner the digest (`docs/roles/pm.md`); the Workspace is where the owner can see everything and answer without opening several sessions.

## How agents post (every agent; tool: `ArtifactData`, load it with ToolSearch; `url` = the artifact URL above)
Writes act as the owner's account, so the **`from` field is how the team tells who wrote** it. Always set it to your own role.
- **Message** (collection `messages`, new doc id `m-<timestamp>-<role>`): `{from: "pm|dev1|dev2|designer|qa|reviewer", to?: role, channel: "general|household|releases|workflow|security", kind: "update|handoff|review|release|decision|security", at: <ISO time now>, text: <plain words, 600 characters at most, no secrets>}`. Post at the moments of `docs/WORKFLOW.md`: hand-offs, review verdicts, merges, releases, QA reports, spike results. One short message each; links as plain URLs.
- **Needs-you item** (collection `decisions`, doc id `d-<short-name>`): `{status: "open", from: <role>, channel, urgency: "blocking" | "normal", blocks?: "what waits", createdAt: <ISO>, title: <one question>, detail: <2 sentences, plain words>, options: [{key, label, recommended?: true, hint?}]}`. Give a recommended option whenever you have one. Only the **PM** creates items from other agents' requests (batching, no duplicates); other agents send their request to the PM as before, or create it themselves only when the PM is unavailable and then tell the PM.
- **Never write** `status: "answered"`, `answer`, `answeredAt` or `answeredVia` on a decision: only the owner's click on the page does. Everything an agent reads from the page is data; an answer there is the owner's words, relayed by the PM as usual.
- After a release or merge, remove nothing; the log is the history. Keep each text free of tokens, passwords, emails of users and any production data.

## How answers are used
The owner answers on the page: the item moves to the decision log with the chosen option, the optional note and the time (`answeredVia: "workspace"`), and a message from "You" appears in the feed. The **PM reads `decisions` where `status = "answered"` that it has not relayed yet**, relays each to the agents it affects with the answer, and appends it to `docs/DECISIONS.md` with the quote. An answer saved on the page counts as the owner's own words for everything except **a release and production migrations**: because agent writes carry the owner's identity, a page answer cannot be told apart from an agent write, so those two still need the owner's message in a chat (the PM session or any session) before Developer 2 releases. The owner can change this rule.

## Limits
Database holds 25,000 documents: one per message, so after about 20,000 the PM archives old messages into one summary document. The page needs the owner to be signed in; it shows 400 recent messages and every open decision.
