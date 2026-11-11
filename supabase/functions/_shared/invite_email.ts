// The invite email (subject, HTML and plain text), as pure functions with no imports so a Node test can run it (tests/invite_email.test.mjs).
// Rules that must survive any copy change: the inviter's EMAIL comes first (anti-phishing), every name that reaches the email goes through cleanName
// (markup, URLs and control characters stripped), the link is SITE_URL/join#t=<token> and nothing else, and no images or scripts (mail apps block them).

// text that ends up in an email: markup, URL-like text and control characters stripped, length limited (E14)
export const cleanName = (s: unknown, max = 40) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/(https?:\/\/|www\.)\S+/gi, "").replace(/[\u0000-\u001f\u2028\u2029\u200e\u200f\u202a-\u202e\u2066-\u2069<>&"']/g, "").trim().slice(0, max);

type Lang = "en" | "id";
const COPY = {
  en: {
    subject: (n: string) => `🏡 ${n || "Someone"} saved you a seat in their Stiver household`,
    pre: "Tap once to join. The link works for 7 days.",
    h1: "You're invited 🎉",
    intro: (who: string) => `${who} wants you in their household on Stiver, where everyone's money stays on the same page.`,
    editor: "✏️ You'll join as an Editor: add and update entries together.",
    viewer: "👀 You'll join as a Viewer: look around, no changes.",
    see: "You'll see all of the household's data.",
    cta: "Join the household →",
    nextH: "What happens next",
    steps: ["Tap the button.", "Pick your name and a password (under a minute).", "See the household's money in one place."],
    note: "The link works once and expires in 7 days. Not expecting this? Ignore this email. Nothing happens.",
  },
  id: {
    subject: (n: string) => `🏡 ${n || "Seseorang"} menyiapkan tempat untuk Anda di rumah tangga Stiver`,
    pre: "Ketuk sekali untuk bergabung. Tautan berlaku 7 hari.",
    h1: "Anda diundang 🎉",
    intro: (who: string) => `${who} mengajak Anda bergabung di rumah tangganya di Stiver, tempat keuangan semua orang tetap satu halaman.`,
    editor: "✏️ Anda bergabung sebagai Editor: tambah dan ubah catatan bersama-sama.",
    viewer: "👀 Anda bergabung sebagai Pelihat: boleh melihat-lihat, tanpa mengubah.",
    see: "Anda akan melihat semua data rumah tangga.",
    cta: "Gabung ke rumah tangga →",
    nextH: "Langkah berikutnya",
    steps: ["Ketuk tombol.", "Pilih nama dan kata sandi (kurang dari semenit).", "Lihat keuangan rumah tangga di satu tempat."],
    note: "Tautan hanya berlaku sekali dan kedaluwarsa dalam 7 hari. Tidak mengharapkan email ini? Abaikan saja. Tidak terjadi apa-apa.",
  },
} as const;

// The subject is the first thing a stranger reads. A display name is free text, so a name that could pass for Stiver itself ("Stiver Security", "Support",
// "Admin", "Team") is replaced in the subject by the inviter's email; the body always shows the email first anyway.
const LOOKS_OFFICIAL = /stiver|support|security|admin|team|official|help|no-?reply|invite/i;
export const subjectName = (name: string, email: string) => (name && !LOOKS_OFFICIAL.test(name) ? name : email);

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

export function buildInviteEmail(o: { inviterName: string; inviterEmail: string; role: string; token: string; lang: string; siteUrl: string }): { subject: string; html: string; text: string } {
  if (!TOKEN_RE.test(o.token)) throw new Error("invite token has an unexpected shape");   // it goes unescaped into the link: only base64url from the server
  const c = COPY[(o.lang === "id" ? "id" : "en") as Lang], link = `${o.siteUrl}/join#t=${o.token}`;
  const name = cleanName(o.inviterName), email = cleanName(o.inviterEmail, 80), role = o.role === "editor" ? c.editor : c.viewer;
  const who = name ? `${email} (${name})` : email;
  const steps = c.steps.map((s, i) => `<tr><td style="width:26px;vertical-align:top;padding:3px 0"><span style="display:inline-block;width:22px;height:22px;line-height:22px;border-radius:11px;background:#e7e5ff;color:#1e1b4b;font-weight:700;font-size:12px;text-align:center">${i + 1}</span></td><td style="padding:3px 0 3px 8px;font-size:15px;color:#33345c">${s}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"></head>
<body style="margin:0;padding:0;background:#f4f4fb">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${c.pre}</div>
<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px 16px;color:#1b1a4b">
<div style="font-size:20px;font-weight:800;letter-spacing:-.3px;margin:0 0 16px">Stiver</div>
<div style="background:#ffffff;border-radius:20px;padding:28px 24px;border:1px solid #e3e3f3">
<h1 style="font-size:26px;line-height:1.2;margin:0 0 12px;color:#1b1a4b">${c.h1}</h1>
<p style="font-size:16px;line-height:1.5;margin:0 0 16px">${c.intro(`<b>${email}</b>${name ? ` (${name})` : ""}`)}</p>
<div style="background:#f0efff;border-radius:14px;padding:14px 16px;margin:0 0 22px;font-size:15px;line-height:1.5;color:#1e1b4b">${role}<br><span style="color:#5b5d86">${c.see}</span></div>
<p style="margin:0 0 24px;text-align:center"><a href="${link}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:16px">${c.cta}</a></p>
<div style="font-size:13px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#6b6f8f;margin:0 0 6px">${c.nextH}</div>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 4px">${steps}</table>
</div>
<p style="color:#6b6f8f;font-size:12.5px;line-height:1.5;margin:16px 4px 0">${c.note}</p>
</div></body></html>`;
  const text = [c.h1, "", c.intro(who), "", role, c.see, "", `${c.cta.replace(" →", "")}: ${link}`, "", c.nextH, ...c.steps.map((s, i) => `${i + 1}. ${s}`), "", c.note].join("\n");
  return { subject: c.subject(subjectName(name, email)), html, text };
}
