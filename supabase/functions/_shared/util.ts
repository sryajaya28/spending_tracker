// Shared helpers for the household Edge Functions (design section 5). Secrets come only from the function environment:
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY (provided by Supabase), RESEND_API_KEY, MAIL_FROM, SITE_URL,
// ALLOWED_ORIGINS (comma list, optional). Nothing secret is logged or returned; logs carry status codes only.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!, SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
export const admin = createClient(URL_, SVC, { auth: { persistSession: false } });
export const anonClient = () => createClient(URL_, ANON, { auth: { persistSession: false } });
export const SITE_URL = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
const ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? SITE_URL).split(",").map((s) => s.trim()).filter(Boolean);

// restrictive CORS: only the configured origins are echoed back; with none configured NO allow-origin header is sent at all (E9)
export function corsHeaders(req: Request): Record<string, string> {
  const o = req.headers.get("origin") ?? "";
  const h: Record<string, string> = {
    "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
    "access-control-allow-methods": "POST, OPTIONS", "vary": "origin", "content-type": "application/json",
  };
  if (ORIGINS.includes(o)) h["access-control-allow-origin"] = o;
  return h;
}
export const reply = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
export const preflight = (req: Request) => (req.method === "OPTIONS" ? new Response(null, { status: 204, headers: corsHeaders(req) }) : null);
// a body that is not a JSON object (null, a number, broken JSON) gets a clean 400 with CORS, never an uncaught 500 (E8)
export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  const b = await req.json().catch(() => null);
  return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
}

export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function randomToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Client address (E2, verified on staging with a throwaway header-echo function, normal call and a forged X-Forwarded-For 203.0.113.9):
// the platform overwrites a forged x-forwarded-for; the real client address arrives in cf-connecting-ip and sb-forwarded-for (identical), and
// x-forwarded-for is "client, client, edge-proxy" (first entry = client). So: cf-connecting-ip, else sb-forwarded-for, else the FIRST
// x-forwarded-for entry; never a later one. The IP-independent global limits in the functions stay as the backstops (a shared address
// such as an office or a mobile carrier puts many people in one bucket, and IPv6 callers can rotate within their prefix).
export function clientIp(req: Request): string {
  const h = (n: string) => (req.headers.get(n) ?? "").trim();
  const first = h("x-forwarded-for").split(",")[0].trim();
  return h("cf-connecting-ip") || h("sb-forwarded-for") || first || "unknown";
}
// the IP hash is salted (an unsalted hash of an IPv4 is reversible) and bucketed so join/preview and sign-up never share a counter
const SALT = await sha256("household-ip:" + SVC);
export const ipBucketHash = (req: Request, bucket: string) => sha256(`${SALT}:${bucket}:${clientIp(req)}`);

// text that ends up in an email: markup, URL-like text and control characters stripped, length limited (E14)
export const cleanName = (s: unknown, max = 40) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/(https?:\/\/|www\.)\S+/gi, "").replace(/[\u0000-\u001f<>&"']/g, "").trim().slice(0, max);
// a STORED display name keeps apostrophes and ampersands (O'Brien); only control characters and angle brackets go; output is escaped where shown (E13)
export const storedName = (s: unknown, max = 60) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max);
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PASSWORD_MIN = 8;                              // same minimum as sign-up
export const PASSWORD_MAX_BYTES = 72;                       // bcrypt limit: counted in BYTES, not characters (E1)
export const passwordOk = (p: string) => p.length >= PASSWORD_MIN && new TextEncoder().encode(p).length <= PASSWORD_MAX_BYTES;

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

export const ago = (ms: number) => new Date(Date.now() - ms);
export const HOUR = 3600_000, DAY = 24 * HOUR;
export type Limit = { filters: Record<string, string>; since: number; max: number };
// Rate limit that FAILS CLOSED (E4): returns false when any window is already full OR when the limiter itself errors. The attempt row is
// inserted only when under every limit (so a flood cannot grow the table), and before any existence lookup the caller does afterwards.
export async function takeAttempt(table: string, row: Record<string, string>, limits: Limit[]): Promise<boolean> {
  try {
    for (const l of limits) {
      let q = admin.from(table).select("id", { count: "exact", head: true }).gte("at", ago(l.since).toISOString());
      for (const [k, v] of Object.entries(l.filters)) q = q.eq(k, v);
      const { count, error } = await q;
      if (error || count === null || count >= l.max) return false;
    }
    const { error } = await admin.from(table).insert(row);
    return !error;
  } catch { return false; }
}
// total invites really created or resent in the window, across all owners and addresses (IP-independent backstop)
export async function totalSends(since: number): Promise<number | null> {
  const { count, error } = await admin.from("invite_sends").select("id", { count: "exact", head: true }).gte("at", ago(since).toISOString());
  return error ? null : (count ?? 0);
}
// count of invites really created or resent for an address, across owners (E3)
export async function sendsLast(emailHash: string, since: number): Promise<number | null> {
  const { count, error } = await admin.from("invite_sends").select("id", { count: "exact", head: true }).eq("email_hash", emailHash).gte("at", ago(since).toISOString());
  return error ? null : (count ?? 0);
}

// revoke an invite and, only when the guard in the database allows it (never a real person's login), delete the half-created login
export async function cleanupInvite(ownerId: string, inviteId: string): Promise<void> {
  const { data } = await admin.rpc("revoke_invite", { p_owner: ownerId, p_invite: inviteId });
  if (data?.result === "ok" && data.deletable && data.invited_user_id) await admin.auth.admin.deleteUser(data.invited_user_id);
}

const COPY = {
  en: { subject: "You're invited to a household on Stiver", hello: "invited you to share a household on Stiver as", editor: "an Editor (can add and change entries)", viewer: "a Viewer (read only)", cta: "Accept invitation", note: "The link works once and expires in 7 days. If you were not expecting this, ignore this email.", see: "You will see all of the household's data." },
  id: { subject: "Anda diundang ke rumah tangga di Stiver", hello: "mengundang Anda berbagi rumah tangga di Stiver sebagai", editor: "Editor (dapat menambah dan mengubah catatan)", viewer: "Pembaca (hanya melihat)", cta: "Terima undangan", note: "Tautan hanya berlaku sekali dan kedaluwarsa dalam 7 hari. Abaikan email ini jika Anda tidak mengharapkannya.", see: "Anda akan melihat semua data rumah tangga." },
} as const;

// our own sender (the join token never goes through GoTrue). Fixed wording; the inviter's EMAIL comes first, then the cleaned name.
// Result: 'sent' (2xx), 'failed' (4xx: certainly not sent), 'unknown' (timeout or 5xx: the mail may have gone out, so the caller keeps the
// invite pending instead of revoking, E6). Only status codes are logged.
export async function sendInviteEmail(o: { to: string; inviterName: string; inviterEmail: string; role: string; token: string; lang: string }): Promise<"sent" | "failed" | "unknown"> {
  const key = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("MAIL_FROM");
  if (!key || !from || !SITE_URL) return "failed";
  const c = COPY[o.lang === "id" ? "id" : "en"], link = `${SITE_URL}/join#t=${o.token}`;
  const role = o.role === "editor" ? c.editor : c.viewer;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;color:#1b1a4b">
<h2 style="margin:0 0 12px">Stiver</h2>
<p><b>${cleanName(o.inviterEmail, 80)}</b> (${cleanName(o.inviterName)}) ${c.hello} ${role}.</p>
<p><a href="${link}" style="display:inline-block;background:#1e1b4b;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">${c.cta}</a></p>
<p style="color:#6b6f8f;font-size:13px">${c.see}<br>${c.note}</p></div>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ from, to: [o.to], subject: c.subject, html }), signal: AbortSignal.timeout(10000),
    });
    if (r.ok) return "sent";
    console.log("resend status", r.status);
    return r.status >= 500 ? "unknown" : "failed";
  } catch { console.log("resend timeout or network error"); return "unknown"; }
}
