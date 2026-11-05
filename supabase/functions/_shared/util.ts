// Shared helpers for the household Edge Functions (design section 5). Secrets come only from the function environment:
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY (provided by Supabase), RESEND_API_KEY, MAIL_FROM, SITE_URL,
// ALLOWED_ORIGINS (comma list, optional). Nothing secret is logged or returned.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!, SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
export const admin = createClient(URL_, SVC, { auth: { persistSession: false } });
export const anonClient = () => createClient(URL_, ANON, { auth: { persistSession: false } });
export const SITE_URL = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
const ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? SITE_URL).split(",").map((s) => s.trim()).filter(Boolean);

// restrictive CORS: only the configured origins are echoed back
export function corsHeaders(req: Request): Record<string, string> {
  const o = req.headers.get("origin") ?? "";
  return {
    "access-control-allow-origin": ORIGINS.includes(o) ? o : (ORIGINS[0] ?? "null"),
    "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
    "access-control-allow-methods": "POST, OPTIONS",
    "vary": "origin",
    "content-type": "application/json",
  };
}
export const reply = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
export const preflight = (req: Request) => (req.method === "OPTIONS" ? new Response(null, { status: 204, headers: corsHeaders(req) }) : null);

export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function randomToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
// the client address only from the platform's own header, never from the request body
export const clientIp = (req: Request) => req.headers.get("cf-connecting-ip") ?? (req.headers.get("x-forwarded-for") ?? "").split(",").pop()?.trim() ?? "unknown";
// text that ends up in an email: markup and control characters stripped, length limited
export const cleanName = (s: unknown, max = 40) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f<>&"']/g, "").trim().slice(0, max);
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PASSWORD_MIN = 8;   // same minimum as sign-up

export type Owner = { uid: string; name: string; email: string; language: string };
// the caller, taken only from the JWT, must be an owner (status 'owner', not a member)
export async function callerOwner(req: Request): Promise<Owner | null> {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
  if (!jwt) return null;
  const { data } = await admin.auth.getUser(jwt);
  const u = data?.user;
  if (!u) return null;
  const { data: p } = await admin.from("profiles").select("display_name, household_status, language").eq("id", u.id).maybeSingle();
  if (!p || p.household_status !== "owner") return null;
  const { data: m } = await admin.from("household_members").select("member_id").eq("member_id", u.id).maybeSingle();
  if (m) return null;
  return { uid: u.id, name: p.display_name ?? "", email: u.email ?? "", language: p.language === "id" ? "id" : "en" };
}

// rate limits count ATTEMPTS: the row is inserted first, then the window is counted
export async function countSince(table: string, filters: Record<string, string>, since: Date): Promise<number> {
  let q = admin.from(table).select("id", { count: "exact", head: true }).gte("at", since.toISOString());
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { count } = await q;
  return count ?? 0;
}
export const ago = (ms: number) => new Date(Date.now() - ms);
export const HOUR = 3600_000, DAY = 24 * HOUR;

const COPY = {
  en: { subject: "You're invited to a household on Stiver", hello: "invited you to share a household on Stiver as", editor: "an Editor (can add and change entries)", viewer: "a Viewer (read only)", cta: "Accept invitation", note: "The link works once and expires in 7 days. If you were not expecting this, ignore this email.", see: "They will see all of the household's data." },
  id: { subject: "Anda diundang ke rumah tangga di Stiver", hello: "mengundang Anda berbagi rumah tangga di Stiver sebagai", editor: "Editor (dapat menambah dan mengubah catatan)", viewer: "Pembaca (hanya melihat)", cta: "Terima undangan", note: "Tautan hanya berlaku sekali dan kedaluwarsa dalam 7 hari. Abaikan email ini jika Anda tidak mengharapkannya.", see: "Anda akan melihat semua data rumah tangga." },
} as const;

// our own sender (the join token never goes through GoTrue). Fixed wording; only the cleaned name and the inviter's email vary.
export async function sendInviteEmail(o: { to: string; inviterName: string; inviterEmail: string; role: string; token: string; lang: string }): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("MAIL_FROM");
  if (!key || !from || !SITE_URL) return false;
  const c = COPY[o.lang === "id" ? "id" : "en"], link = `${SITE_URL}/join#t=${o.token}`;
  const role = o.role === "editor" ? c.editor : c.viewer;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;color:#1b1a4b">
<h2 style="margin:0 0 12px">Stiver</h2>
<p><b>${cleanName(o.inviterName)}</b> (${cleanName(o.inviterEmail, 80)}) ${c.hello} ${role}.</p>
<p><a href="${link}" style="display:inline-block;background:#1e1b4b;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">${c.cta}</a></p>
<p style="color:#6b6f8f;font-size:13px">${c.see}<br>${c.note}</p></div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ from, to: [o.to], subject: c.subject, html }),
  });
  return r.ok;
}

// revoke an invite and, only when the guard in the database allows it (never a real person's login), delete the half-created login
export async function cleanupInvite(ownerId: string, inviteId: string): Promise<void> {
  const { data } = await admin.rpc("revoke_invite", { p_owner: ownerId, p_invite: inviteId });
  if (data?.result === "ok" && data.deletable && data.invited_user_id) await admin.auth.admin.deleteUser(data.invited_user_id);
}
