# Household spike 2: staging results (2026-11-05, Full-stack engineer)
Run on STAGING with the deployed Edge Functions, one real invite (to a +alias inbox of the owner), the smoke account as owner. All test data cleaned up (member login deleted, test transactions deleted).

| Check | Result |
|---|---|
| Invite email via our sender (Resend) | sent from invites@stiver.io; names inviter and role, one Accept button, "works once, expires in 7 days"; link `/join#t=...` |
| Duplicate invite / existing account / bad email / bad role / no auth | `already_invited` / `cannot_invite` (nothing sent) / 400 / 400 / 403 |
| Garbage, short, empty join token | all the same generic `invalid_link` (400) |
| Preview | owner name and role; works again after refused attempts (nothing consumed) |
| Join with password < 8, 80 BYTES, blank name | `invalid_input`; link stays usable |
| Join (good) | 200 with session; membership; `email_verified` is the only user_metadata key |
| Link reuse / preview after use | generic `invalid_link` |
| Member sees owner's wallets, household_people (with email) | yes |
| Editor adds a transaction | row lands on the owner's household, `created_by` = the editor |
| Editor edits / deletes the OWNER's transaction | 0 rows changed (RLS), nothing deleted |
| Editor edits own transaction | ok, `rev` increments |
| Member calls invite-member / set_member_role | 403 / 42501 "only the owner can change roles" |
| Owner sets role to viewer | viewer insert -> 403 RLS; viewer still reads; household_state readable |
| Owner removes member | old access token reads 0 rows (fail closed); GoTrue `/user` still answers 200 for that token (a deleted session does NOT invalidate the JWT at GoTrue, RLS does); sign-in again works, profile `former_member`, reads 0 rows |
| Former member "Delete my login" | `ok` |
| **Stale revision update** | **FAILED on staging: 504.** PostgREST retries SQLSTATE 40001 (log: `household_stale` once a second for ~60 s). Fix: migration 30 raises `PT409` (HTTP 409, not retried); client classifier accepts it. Local tests 128/128. |

Not run yet: refresh token after removal (needs a second test member), `admin.updateUserById` GoTrue password policy beyond our own 8..72-byte check, invite-sweep with the real service key (Tech-Lead), resend (old link stops), leave_household, owner delete.
Follow-up for the design: Edge Functions authenticated with `getUser` cannot rely on the JWT being rejected after removal; they check the owner status server-side (invite-member returned 403 for the member), which held.
