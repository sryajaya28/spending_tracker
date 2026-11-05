// invite-sweep: scheduled daily (service role only). Marks expired invites and deletes the half-created logins the database allows (design 16).
import { admin } from "../_shared/util.ts";

Deno.serve(async (req) => {
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
  if (!bearer || bearer !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return new Response(JSON.stringify({ error: "not_allowed" }), { status: 403 });
  const { data } = await admin.rpc("household_expire_invites");
  let deleted = 0;
  for (const row of (data ?? []) as { invited_user_id: string }[]) {
    const { error } = await admin.auth.admin.deleteUser(row.invited_user_id);
    if (!error) deleted++;
  }
  return new Response(JSON.stringify({ expired: (data ?? []).length, deleted }), { headers: { "content-type": "application/json" } });
});
