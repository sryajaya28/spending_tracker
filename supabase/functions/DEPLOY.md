# Household Edge Functions: deploy settings (a pinned list, not a config.toml, so no CLI project is implied)

| Function | verify_jwt | Why |
|---|---|---|
| invite-member | true | the caller is an owner signed in |
| manage-invite | true | same |
| delete-my-login | true | a former member signed in |
| join-household | **false** | the invitee has no account session; every call presents the join token |
| signup-gate | **false** | public sign-up |
| invite-sweep | **false** | scheduled; the function compares the bearer with the service key in constant time |

Secrets (Supabase dashboard, entered by the owner, never in the repo): `RESEND_API_KEY`, `MAIL_FROM`, `SITE_URL`, optional `ALLOWED_ORIGINS`.
Deploy only after code review and, for staging, after the spike checks (design section 15): the client-address header, `admin.updateUserById` and
long/weak passwords, whether `getUser` rejects a JWT whose session was deleted, and the `invite-sweep` key check.

## First staging task (Developer 2's condition E2)
Before any limit is described as protection: deploy a throwaway function that logs the raw request headers for a normal call and for one with a forged
`X-Forwarded-For`, choose the header from that evidence, write it into `_shared/util.ts` (`clientIp`) and the design, then delete the throwaway function.
IP-independent backstops already in the code (fail closed): join + preview <= 300/h in total, signup-gate <= 300/h in total, invites sent <= 200/h in total,
per-token <= 10/h. The per-IP limit is not claimed as protection in release notes until that run is done.
Double submit of the join form: the invite is claimed atomically (`join_household_claim`) before the password is set; the client also disables the button after the first tap.
