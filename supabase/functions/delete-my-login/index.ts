// delete-my-login: a former member deletes their own login (design 8). The caller comes ONLY from the JWT and must be a former member.
import { admin, reply, preflight } from "../_shared/util.ts";

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== "POST") return reply(req, { error: "method" }, 405);
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
  const { data } = jwt ? await admin.auth.getUser(jwt) : { data: null };
  const uid = data?.user?.id;
  if (!uid) return reply(req, { error: "not_allowed" }, 403);
  const { data: p } = await admin.from("profiles").select("household_status").eq("id", uid).maybeSingle();
  if (p?.household_status !== "former_member") return reply(req, { error: "not_allowed" }, 403);
  const { error } = await admin.auth.admin.deleteUser(uid);
  return error ? reply(req, { error: "server" }, 500) : reply(req, { result: "ok" });
});
