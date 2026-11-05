// manage-invite: an owner revokes or resends a pending invite (design 5.3). Resend rotates the token (the old link dies).
import { admin, callerOwner, reply, preflight, sha256, randomToken, countSince, ago, HOUR, DAY, sendInviteEmail, cleanupInvite } from "../_shared/util.ts";

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== "POST") return reply(req, { error: "method" }, 405);
  const owner = await callerOwner(req);
  if (!owner) return reply(req, { error: "not_allowed" }, 403);
  let b: any; try { b = await req.json(); } catch { return reply(req, { error: "bad_request" }, 400); }
  const id = String(b.invite_id ?? "");
  if (b.action === "revoke") {
    await cleanupInvite(owner.uid, id);
    return reply(req, { result: "ok" });
  }
  if (b.action === "resend") {
    const { data: inv } = await admin.from("household_invites").select("email, role").eq("id", id).eq("owner_id", owner.uid).eq("status", "pending").maybeSingle();
    if (!inv) return reply(req, { result: "not_found" }, 404);
    await admin.from("invite_attempts").insert({ owner_id: owner.uid, email_hash: await sha256(inv.email) });
    if (await countSince("invite_attempts", { owner_id: owner.uid }, ago(HOUR)) > 10) return reply(req, { result: "rate_limited" }, 429);
    const token = randomToken();
    const { data: ok } = await admin.rpc("resend_invite", { p_owner: owner.uid, p_invite: id, p_token_hash: await sha256(token), p_expires: new Date(Date.now() + 7 * DAY).toISOString() });
    if (!ok) return reply(req, { result: "not_found" }, 404);
    const sent = await sendInviteEmail({ to: inv.email, inviterName: owner.name, inviterEmail: owner.email, role: inv.role, token, lang: owner.language });
    return sent ? reply(req, { result: "ok" }) : reply(req, { error: "mail_failed" }, 502);
  }
  return reply(req, { error: "bad_request" }, 400);
});
