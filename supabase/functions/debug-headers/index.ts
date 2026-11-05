// THROWAWAY (spike 2, condition E2): returns the caller's own request headers (credentials removed) so we can see which header carries the real
// client IP on Supabase Edge Functions, with and without a forged X-Forwarded-For. Deploy to STAGING only, verify_jwt=false, delete after the run.
Deno.serve((req) => {
  const h: Record<string, string> = {};
  req.headers.forEach((v, k) => { if (!/^(authorization|apikey|cookie|x-client-info)$/i.test(k)) h[k] = v; });
  return new Response(JSON.stringify({ headers: h }, null, 1), { headers: { "content-type": "application/json" } });
});
