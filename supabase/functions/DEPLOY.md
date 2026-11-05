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
