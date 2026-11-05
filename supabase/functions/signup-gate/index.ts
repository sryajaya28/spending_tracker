// signup-gate: public sign-up goes through here so that a fresh address, an existing account and a pending-invite address all get the SAME
// answer, immediately (design 5.5, E7). UX only, not a security control: GoTrue's own sign-up stays reachable; safety rests on join-household.
import { admin, anonClient, reply, preflight, readJson, sha256, ipBucketHash, takeAttempt, HOUR, EMAIL_RE, passwordOk, SITE_URL } from "../_shared/util.ts";

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== "POST") return reply(req, { error: "method" }, 405);
  const b = await readJson(req); if (!b) return reply(req, { error: "bad_request" }, 400);
  const email = String(b.email ?? "").trim().toLowerCase(), password = String(b.password ?? "");
  const ipHash = await ipBucketHash(req, "signup");   // its own bucket: sign-ups never share a counter with join/preview
  if (!(await takeAttempt("join_attempts", { ip_hash: ipHash, token_hash: await sha256("signup:" + email) }, [{ filters: { ip_hash: ipHash }, since: HOUR, max: 30 }]))) return reply(req, { error: "rate_limited" }, 429);
  if (!EMAIL_RE.test(email) || email.length > 254 || !passwordOk(password)) return reply(req, { error: "invalid_input" }, 400);

  // answer first, work after: the response time must not tell a fresh address from an existing one (E7)
  const work = (async () => {
    const { data: known, error } = await admin.rpc("email_exists", { p_email: email });
    if (error || known !== false) return;
    const { error: se } = await anonClient().auth.signUp({ email, password, options: { emailRedirectTo: SITE_URL || undefined, captchaToken: String(b.captchaToken ?? "") || undefined,
      data: { full_name: String(b.full_name ?? "").slice(0, 80), currency: String(b.currency ?? "USD").slice(0, 3) } } });
    if (se) console.log("signup error", se.status ?? se.code);   // logged, the answer stays the same
  })();
  const rt = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (rt) rt.waitUntil(work); else await work;
  return reply(req, { result: "check_email" });
});
