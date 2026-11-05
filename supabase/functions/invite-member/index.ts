// invite-member: an owner invites someone as editor or viewer (design 5.1). verify_jwt ON; the caller is taken from the JWT only.
import { admin, callerOwner, reply, preflight, readJson, sha256, randomToken, EMAIL_RE, takeAttempt, sendsLast, HOUR, DAY, sendInviteEmail, cleanupInvite } from "../_shared/util.ts";

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== "POST") return reply(req, { error: "method" }, 405);
  const owner = await callerOwner(req);
  if (!owner) return reply(req, { error: "not_allowed" }, 403);
  const b = await readJson(req); if (!b) return reply(req, { error: "bad_request" }, 400);
  const email = String(b.email ?? "").trim().toLowerCase(), role = String(b.role ?? "");
  const emailHash = await sha256(email);
  // the per-owner hourly limit counts every attempt (failed ones too) and fails closed; the row is written before any existence lookup (E4)
  if (!(await takeAttempt("invite_attempts", { owner_id: owner.uid, email_hash: emailHash }, [{ filters: { owner_id: owner.uid }, since: HOUR, max: 10 }]))) return reply(req, { result: "rate_limited" }, 429);
  if (!EMAIL_RE.test(email) || email.length > 254 || !["editor", "viewer"].includes(role)) return reply(req, { result: "invalid" }, 400);
  // the per-email cap counts SENDS across owners (an invite really created or resent), so nobody can burn it with failed attempts (E3)
  const sent24 = await sendsLast(emailHash, DAY);
  if (sent24 === null || sent24 >= 3) return reply(req, { result: "rate_limited" }, 429);

  const token = randomToken(), tokenHash = await sha256(token);
  const { data: r, error } = await admin.rpc("create_invite", { p_owner: owner.uid, p_email: email, p_role: role, p_token_hash: tokenHash, p_expires: new Date(Date.now() + 7 * DAY).toISOString() });
  if (error || !r) return reply(req, { error: "server" }, 500);
  if (r.result !== "ok") return reply(req, { result: r.result });   // cannot_invite | already_invited | full | invalid (one generic answer per case)

  // create the unconfirmed login WITHOUT any mail and with nothing secret in user_metadata; handle_new_user marks it 'invited' and does not seed it
  const { data: link, error: le } = await admin.auth.admin.generateLink({ type: "invite", email });
  const uid = link?.user?.id;
  if (le || !uid) { await cleanupInvite(owner.uid, r.invite_id); return reply(req, { error: "server" }, 500); }
  // E5: a stray unconfirmed normal sign-up on this address (status 'owner', seeded) would make every join fail later: refuse it now
  const { data: prof } = await admin.from("profiles").select("household_status").eq("id", uid).maybeSingle();
  if (prof?.household_status !== "invited") { await cleanupInvite(owner.uid, r.invite_id); return reply(req, { result: "cannot_invite" }); }
  const { error: ue } = await admin.from("household_invites").update({ invited_user_id: uid }).eq("id", r.invite_id);   // E6: checked
  if (ue) { await cleanupInvite(owner.uid, r.invite_id); return reply(req, { error: "server" }, 500); }
  await admin.from("invite_sends").insert({ email_hash: emailHash });
  const sent = await sendInviteEmail({ to: email, inviterName: owner.name, inviterEmail: owner.email, role, token, lang: owner.language });
  if (sent === "failed") { await cleanupInvite(owner.uid, r.invite_id); return reply(req, { error: "mail_failed" }, 502); }
  // 'unknown' (timeout or 5xx) may still have delivered: the invite stays pending and the owner can use Resend (E6)
  return reply(req, { result: "ok", invite_id: r.invite_id, mail: sent === "sent" ? "sent" : "pending" });
});
