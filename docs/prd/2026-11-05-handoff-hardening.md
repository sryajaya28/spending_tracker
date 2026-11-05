# PRD: Harden the sign-in handoff functions   (backlog item b-handoff-hardening, from the security review 2026-11-04)

Status: `PRD v1 | owner approved: pending (gate 1) | Figma: not needed unless the owner declines fast lane for one message | Branch: prd/handoff-hardening | QA report: pending`

## 1. Problem and goal
The handoff lets someone who is signed in on one browser type a short code on another (for example Safari to the Home Screen app) and be signed in there. The independent security review found three weaknesses: the two database functions (`create_handoff`, `claim_handoff`) do not pin their search path; `claim_handoff` can be called by anyone without signing in and has no limit on wrong guesses (the code is 10 characters, valid 15 minutes, single use); and the sign-in token kept for the handoff is stored in plain text. Not urgent. Goal: guessing a code or reading the table gives an attacker nothing, and the feature works exactly as before for real users.

## 2. Scope
**In:** the two handoff functions and the handoff table (database only), one new "too many tries" message on the code entry screen.
**Out:** the household work (separate branch), any other sign-in flow, changing the code length or the 15-minute lifetime.

## 3. User stories
- As a **user** I can still move my sign-in to another browser with a code, so that I can use the Home Screen app.
- As the **owner** I want guessing codes to be impractical and stored tokens to be useless if the table is read, so that nobody can take over an account through this feature.

## 4. Acceptance checks
1. Given a signed-in user creates a code, when they type it on another browser within 15 minutes, then that browser is signed in as the same user (same as today).
2. Given a code was used once, or 15 minutes passed, then it fails with the existing "invalid or expired" message.
3. Given someone not signed in submits wrong codes repeatedly, then after a small number of misses the claim function refuses all attempts for a short lock (about one minute), so that trying all codes is impractical (QA measures: 10,000 wrong guesses cannot finish within the code lifetime).
4. Given the lock is active, when a real user types a correct code, then they see "Too many tries. Wait a minute and try again." (EN and ID) and succeed after the lock ends; no lock lasts longer than 1 minute.
5. Given someone with read access to the handoff table (including a database backup), then no usable sign-in token or refresh token is readable from it (stored encrypted or replaced by a one-time exchange), and a claimed or expired row is removed.
6. Given the two functions, then each has a fixed `search_path` and only the minimum rights (create: signed-in only; claim: anonymous allowed, rate limited), verified by a database test.
7. Given the change, then the existing handoff e2e test and the staging smoke test still pass, and the migration is applied to staging before production.

## 5. Edge cases and rules
Phone width and dark mode for the one new message; Indonesian text; the lock must not let one attacker lock everyone out for long (hence at most about a minute); existing unexpired codes at release time simply expire; nothing changes for the household build.

## 6. Data and privacy
Migration touches only the handoff function definitions and the handoff table (backwards compatible: old rows expire in 15 minutes). Never to analytics: codes, tokens.

## 7. Analytics
Event `handoff_rate_limited` (no code, no user id). Success metric: no failed handoffs for real users after release (PostHog: ratio of `handoff_claimed` to `handoff_rate_limited` stays high); zero rate-limit events for normal use.

## 8. Design notes
One text message on the existing code entry screen, reusing the current error style. No new screen.

## 9. Open questions (recommended default each)
1. The new "Too many tries" message is a UI string. Default: fast lane for this one string (post the Figma frame, one reply covers design and staging sign-off). Alternative: full design gate.
2. Lock length and misses allowed: default about 5 misses then a 1-minute lock; Developer 2 chooses exact numbers in the technical design.
3. Timing: default after the household release, so the two do not collide in review.

## 10. Release plan
Lane: feature, high-risk (sign-in, database): Developer 2 builds and the other model reviews; no peer-reviewing your own change. Migration to staging first, regression and staging sign-off by the owner, production migration only on the owner's release message. Success is read from PostHog 7 days after release.
