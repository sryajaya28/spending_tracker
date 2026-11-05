// invite-member: an owner invites someone as editor or viewer (design 5.1). Verify_jwt on; the caller is taken from the JWT only.
import { admin, callerOwner, reply, preflight, sha256, randomToken, EMAIL_RE, countSince, ago, HOUR, DAY, sendInviteEmail, cleanupInvite } from "../_shared/util.ts";

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== "POST") return reply(req, { error: "method" }, 405);
  const owner = await callerOwner(req);
  if (!owner) return reply(req, { error: "not_allowed" }, 403);
  let b: any; try { b = await req.json(); } catch { return reply(req, { error: "bad_request" }, 400); }
  const email = String(b.email ?? "").trim().toLowerCase(), role = String(b.role ?? "");
  const emailHash = await sha256(email);
  // every attempt counts, failed ones too, and BEFORE any existence lookup: insert first, then count the window
  await admin.from("invite_attempts").insert({ owner_id: owner.uid, email_hash: emailHash });
  if (await countSince("invite_attempts", { owner_id: owner.uid }, ago(HOUR)) > 10) return reply(req, { result: "rate_limited" }, 429);
  if (await countSince("invite_attempts", { email_hash: emailHash }, ago(DAY)) > 3) return reply(req, { result: "rate_limited" }, 429);
  if (!EMAIL_RE.test(email) || email.length > 254 || !["editor", "viewer"].includes(role)) return reply(req, { result: "invalid" }, 400);

  const token = randomToken(), tokenHash = await sha256(token);
  const { data: r, error } = await admin.rpc("create_invite", { p_owner: owner.uid, p_email: email, p_role: role, p_token_hash: tokenHash, p_expires: new Date(Date.now() + 7 * DAY).toISOString() });
  if (error || !r) return reply(req, { error: "server" }, 500);
  if (r.result !== "ok") return reply(req, { result: r.result });   // cannot_invite | already_invited | full | invalid (one generic answer per case)

  // create the unconfirmed login WITHOUT any mail and with nothing secret in user_metadata; handle_new_user marks it 'invited' and does not seed it
  const { data: link, error: le } = await admin.auth.admin.generateLink({ type: "invite", email });
  const uid = link?.user?.id;
  if (le || !uid) { await cleanupInvite(owner.uid, r.invite_id); return reply(req, { error: "server" }, 500); }
  await admin.from("household_invites").update({ invited_user_id: uid }).eq("id", r.invite_id);
  const sent = await sendInviteEmail({ to: email, inviterName: owner.name, inviterEmail: owner.email, role, token, lang: owner.language });
  if (!sent) { await cleanupInvite(owner.uid, r.invite_id); return reply(req, { error: "mail_failed" }, 502); }
  return reply(req, { result: "ok", invite_id: r.invite_id });
});
