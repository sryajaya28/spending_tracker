// invite-sweep: scheduled daily (service role only). Marks expired invites, deletes the half-created logins the database allows (retried every
// run, E11), prunes limiter rows older than 7 days (E4) and reports how many join refusals were recorded in the last day (E12).
// verify_jwt OFF: the function itself compares the bearer with the service key in constant time. (To confirm on staging: that this works with
// the new sb_secret_ keys.)
import { admin, ago, DAY } from "../_shared/util.ts";

function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

Deno.serve(async (req) => {
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
  if (!bearer || !safeEqual(bearer, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "")) return new Response(JSON.stringify({ error: "not_allowed" }), { status: 403 });
  const { data: expired } = await admin.rpc("household_expire_invites");
  const { data: rows } = await admin.rpc("household_logins_to_delete");
  let deleted = 0;
  for (const row of (rows ?? []) as { invited_user_id: string }[]) {
    const { error } = await admin.auth.admin.deleteUser(row.invited_user_id);
    if (!error) deleted++;
  }
  const cutoff = ago(7 * DAY).toISOString();
  for (const t of ["invite_attempts", "join_attempts", "invite_sends"]) await admin.from(t).delete().lt("at", cutoff);
  const { count: refusals } = await admin.from("security_events").select("id", { count: "exact", head: true }).gte("at", ago(DAY).toISOString());
  return new Response(JSON.stringify({ expired: expired ?? 0, deleted, join_refusals_last_day: refusals ?? 0 }), { headers: { "content-type": "application/json" } });
});
