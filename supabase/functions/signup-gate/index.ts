// signup-gate: public sign-up goes through here so that a fresh address, an existing account and a pending-invite address all get the
// SAME answer (design 5.5). UX only, not a security control: GoTrue's own sign-up stays reachable; safety rests on join-household.
import { admin, anonClient, reply, preflight, sha256, clientIp, countSince, ago, HOUR, EMAIL_RE, PASSWORD_MIN, SITE_URL } from "../_shared/util.ts";

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== "POST") return reply(req, { error: "method" }, 405);
  let b: any; try { b = await req.json(); } catch { return reply(req, { error: "bad_request" }, 400); }
  const email = String(b.email ?? "").trim().toLowerCase(), password = String(b.password ?? "");
  const ipHash = await sha256(clientIp(req));
  await admin.from("join_attempts").insert({ ip_hash: ipHash, token_hash: await sha256("signup:" + email) });
  if (await countSince("join_attempts", { ip_hash: ipHash }, ago(HOUR)) > 30) return reply(req, { error: "rate_limited" }, 429);
  if (!EMAIL_RE.test(email) || email.length > 254 || password.length < PASSWORD_MIN) return reply(req, { error: "invalid_input" }, 400);

  const { data: known } = await admin.rpc("email_exists", { p_email: email });
  if (known === false) {
    await anonClient().auth.signUp({ email, password, options: { emailRedirectTo: SITE_URL || undefined, captchaToken: b.captchaToken || undefined,
      data: { full_name: String(b.full_name ?? "").slice(0, 80), currency: String(b.currency ?? "USD").slice(0, 3) } } });
  }
  // same answer in every case (fresh, existing, pending invite)
  return reply(req, { result: "check_email" });
});
