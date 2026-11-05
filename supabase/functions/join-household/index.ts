// join-household: UNAUTHENTICATED (verify_jwt OFF). Every call presents the join token (design 5.2, B-5). Preview returns only the owner's name and
// the role. Order of a join (E1): read-only account check -> password validated in BYTES -> password set and email confirmed -> apply (re-checks,
// writes the membership and ends every session of the login in ONE transaction) -> server-side sign-in. If the password step fails nothing has
// changed and the same link still works.
import { admin, anonClient, reply, preflight, readJson, sha256, ipBucketHash, storedName, cleanName, takeAttempt, HOUR, passwordOk } from "../_shared/util.ts";

const GENERIC = { error: "invalid_link" };   // one constant answer for unknown, used, expired and revoked tokens

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== "POST") return reply(req, { error: "method" }, 405);
  const b = await readJson(req); if (!b) return reply(req, GENERIC, 400);
  const token = String(b.token ?? ""), tokenHash = await sha256(token), ipHash = await ipBucketHash(req, "join");
  // IP-independent backstop: all join and preview calls together, at most 300 an hour, fails closed (whatever the client-address header does)
  if (!(await takeAttempt("join_attempts", { ip_hash: "G:join", token_hash: "g" }, [{ filters: { ip_hash: "G:join" }, since: HOUR, max: 300 }]))) return reply(req, GENERIC, 429);
  // fails closed; the attempt row is written only while under both limits and always before any token lookup. A preview plus a join is two attempts.
  if (!(await takeAttempt("join_attempts", { ip_hash: ipHash, token_hash: tokenHash }, [
    { filters: { ip_hash: ipHash }, since: HOUR, max: 30 }, { filters: { token_hash: tokenHash }, since: HOUR, max: 10 }]))) return reply(req, GENERIC, 429);
  if (token.length < 20 || token.length > 64) return reply(req, GENERIC, 400);

  const { data: inv } = await admin.from("household_invites").select("id, owner_id, role, email, invited_user_id")
    .eq("token_hash", tokenHash).eq("status", "pending").gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!inv || !inv.invited_user_id) return reply(req, GENERIC, 400);

  if (b.action === "preview") {
    const { data: o } = await admin.from("profiles").select("display_name").eq("id", inv.owner_id).maybeSingle();
    return reply(req, { owner_name: cleanName(o?.display_name), role: inv.role });
  }
  if (b.action !== "join") return reply(req, GENERIC, 400);

  const password = String(b.password ?? ""), name = storedName(b.display_name);
  if (!passwordOk(password) || !name) return reply(req, { error: "invalid_input" }, 400);   // BYTES, before anything changes

  // 1) read-only check of the invited account; a tampered account is refused through apply (which revokes the invite and records the event)
  const { data: why } = await admin.rpc("join_household_check", { p_invite: inv.id, p_user: inv.invited_user_id });
  if (why !== "ok") { await admin.rpc("join_household_apply", { p_invite: inv.id, p_user: inv.invited_user_id, p_display_name: name }); return reply(req, GENERIC, 400); }
  // 1b) claim the invite atomically before the password is set: a second simultaneous submit gets false here and changes nothing
  const { data: claimed } = await admin.rpc("join_household_claim", { p_invite: inv.id });
  if (claimed !== true) return reply(req, GENERIC, 409);
  // 2) the password is set and the email confirmed first: from here nobody else can sign in to this login
  const { error: pe } = await admin.auth.admin.updateUserById(inv.invited_user_id, { password, email_confirm: true });
  if (pe) { await admin.rpc("join_household_release", { p_invite: inv.id }); return reply(req, { error: "password_failed" }, 400); }   // nothing changed; the same link works again
  // 3) apply: re-checks, writes the membership and ends all sessions in one transaction
  const { data: a } = await admin.rpc("join_household_apply", { p_invite: inv.id, p_user: inv.invited_user_id, p_display_name: name });
  if (a?.result !== "ok") return reply(req, GENERIC, 400);   // refused: the invite is revoked, the login holds no membership
  // 4) sign in on the server with the password just set and return only the session (the password is never logged)
  const { data: s, error: se } = await anonClient().auth.signInWithPassword({ email: inv.email, password });
  if (se || !s.session) return reply(req, { result: "joined_sign_in" });   // joined; the client then shows the normal sign-in
  return reply(req, { result: "ok", session: { access_token: s.session.access_token, refresh_token: s.session.refresh_token } });
});
