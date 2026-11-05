// join-household: UNAUTHENTICATED (verify_jwt off). Every call presents the join token (design 5.2, B-5). Preview returns only the owner's
// name and the role. Join sets the password in the same call, so a password chosen earlier by someone else never survives.
import { admin, anonClient, reply, preflight, sha256, clientIp, cleanName, countSince, ago, HOUR, PASSWORD_MIN } from "../_shared/util.ts";

const GENERIC = { error: "invalid_link" };   // one constant answer for unknown, used, expired and revoked tokens

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== "POST") return reply(req, { error: "method" }, 405);
  let b: any; try { b = await req.json(); } catch { return reply(req, GENERIC, 400); }
  const token = String(b.token ?? ""), tokenHash = await sha256(token), ipHash = await sha256(clientIp(req));
  // the attempt row is inserted and counted BEFORE any token lookup (per IP and per token)
  await admin.from("join_attempts").insert({ ip_hash: ipHash, token_hash: tokenHash });
  if (await countSince("join_attempts", { ip_hash: ipHash }, ago(HOUR)) > 30 || await countSince("join_attempts", { token_hash: tokenHash }, ago(HOUR)) > 10) return reply(req, GENERIC, 429);
  if (token.length < 20 || token.length > 64) return reply(req, GENERIC, 400);

  const { data: inv } = await admin.from("household_invites").select("id, owner_id, role, email, invited_user_id, expires_at")
    .eq("token_hash", tokenHash).eq("status", "pending").gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!inv || !inv.invited_user_id) return reply(req, GENERIC, 400);

  if (b.action === "preview") {
    const { data: o } = await admin.from("profiles").select("display_name").eq("id", inv.owner_id).maybeSingle();
    return reply(req, { owner_name: cleanName(o?.display_name), role: inv.role });
  }
  if (b.action !== "join") return reply(req, GENERIC, 400);

  const password = String(b.password ?? ""), name = cleanName(b.display_name);
  if (password.length < PASSWORD_MIN || password.length > 72 || !name) return reply(req, { error: "invalid_input" }, 400);

  // 1) every session of the invited login ends first (an attacker session from a public sign-up, design F2/F3); the login owns no data
  await admin.rpc("delete_user_sessions", { p_user: inv.invited_user_id });
  // 2) the account is checked and the membership is created in ONE transaction (email unchanged, no phone, no MFA, no extra identity...)
  const { data: a } = await admin.rpc("join_household_apply", { p_invite: inv.id, p_user: inv.invited_user_id, p_display_name: name });
  if (a?.result !== "ok") return reply(req, GENERIC, 400);   // 'refused' also revokes the invite and writes security_events
  // 3) the password is set (and the email confirmed) in this same call; the server-side policy above matches sign-up
  const { error: pe } = await admin.auth.admin.updateUserById(inv.invited_user_id, { password, email_confirm: true });
  if (pe) return reply(req, { error: "password_failed" }, 500);
  // 4) sign in on the server with the password just set and return only the session (the password is never logged)
  const { data: s, error: se } = await anonClient().auth.signInWithPassword({ email: inv.email, password });
  if (se || !s.session) return reply(req, { result: "joined_sign_in" });   // joined; the client then shows the normal sign-in
  return reply(req, { result: "ok", session: { access_token: s.session.access_token, refresh_token: s.session.refresh_token } });
});
