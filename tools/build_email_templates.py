#!/usr/bin/env python3
"""Builds the Supabase Auth email templates in supabase/templates/ from one shared layout.

Run:  python3 tools/build_email_templates.py
Then paste each generated .html into Supabase > Authentication > Emails > Templates (subject lines are in
supabase/templates/README.md). Templates use Supabase's variables: {{ .ConfirmationURL }}, {{ .Email }},
{{ .NewEmail }}, {{ .Token }}.

The HTML is email-safe on purpose: tables, inline styles, no images (the logo is plain HTML so nothing can
be blocked), a hidden preheader, a bulletproof button, and light + dark colors.
"""
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "supabase" / "templates"
BRAND, NAVY, MUTED, SOFT = "#4A44C6", "#1E1B4B", "#5C6085", "#F2F3FB"
FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"


def button(label):
    return f"""
<table role="presentation" class="btn-table" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
  <tr><td class="btn" align="center" bgcolor="{BRAND}" style="border-radius:999px;background:{BRAND};">
    <a href="{{{{ .ConfirmationURL }}}}" target="_blank" style="display:inline-block;padding:16px 34px;font-family:{FONT};font-size:16px;font-weight:700;line-height:1;color:#FFFFFF;text-decoration:none;border-radius:999px;">{label}</a>
  </td></tr>
</table>"""


def fallback_link():
    return f"""
<p class="muted" style="margin:18px 0 0;font-family:{FONT};font-size:13px;line-height:1.6;color:{MUTED};">
  Button not working? Copy this link into your browser:<br>
  <a href="{{{{ .ConfirmationURL }}}}" target="_blank" class="link" style="color:{BRAND};word-break:break-all;">{{{{ .ConfirmationURL }}}}</a>
</p>"""


def code_block():
    return f"""
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px;">
  <tr><td class="code" bgcolor="{SOFT}" style="background:{SOFT};border-radius:14px;padding:18px 28px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:8px;color:{NAVY};">{{{{ .Token }}}}</td></tr>
</table>"""


def p(text, muted=False, size=16, top=16):
    color = MUTED if muted else NAVY
    cls = "muted" if muted else "text"
    return f'<p class="{cls}" style="margin:{top}px 0 0;font-family:{FONT};font-size:{size}px;line-height:1.65;color:{color};">{text}</p>'


def layout(title, preheader, heading, body_html):
    pad = "&#8203;&zwnj;" * 40
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>{title}</title>
<style>
  @media (max-width: 620px) {{
    .container {{ width: 100% !important; }}
    .px {{ padding-left: 24px !important; padding-right: 24px !important; }}
    .h1 {{ font-size: 26px !important; }}
    .btn-table {{ width: 100% !important; }}
    .btn a {{ display: block !important; text-align: center; }}
  }}
  @media (prefers-color-scheme: dark) {{
    body, .bg {{ background: #12112B !important; }}
    .card {{ background: #1E1B4B !important; }}
    .h1, .text {{ color: #F2F3FB !important; }}
    .muted {{ color: #A9ACCB !important; }}
    .link {{ color: #A8A5FF !important; }}
    .code {{ background: #2A2766 !important; color: #FFFFFF !important; }}
    .divider {{ border-color: #34307A !important; }}
  }}
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:{SOFT};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">{preheader}{pad}</div>
<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{SOFT}" style="background:{SOFT};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;">
    <tr><td class="px" bgcolor="{BRAND}" style="background:{BRAND};border-radius:20px 20px 0 0;padding:26px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="40" height="40" align="center" valign="middle" bgcolor="#FFFFFF" style="width:40px;height:40px;border-radius:12px;background:#FFFFFF;font-family:{FONT};font-size:24px;font-weight:800;line-height:40px;color:{BRAND};">S</td>
        <td style="padding-left:12px;font-family:{FONT};font-size:24px;font-weight:800;letter-spacing:-0.02em;color:#FFFFFF;">Stiver</td>
      </tr></table>
    </td></tr>
    <tr><td class="card px" bgcolor="#FFFFFF" style="background:#FFFFFF;border-radius:0 0 20px 20px;padding:40px 40px 36px;">
      <h1 class="h1" style="margin:0;font-family:{FONT};font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:{NAVY};">{heading}</h1>
      {body_html}
    </td></tr>
    <tr><td class="px" style="padding:22px 40px 0;">
      <p class="muted" style="margin:0;font-family:{FONT};font-size:12px;line-height:1.6;color:{MUTED};">
        Stiver helps you track spending, budgets and net worth in one place.<br>
        This is an automated message sent to {{{{ .Email }}}}. Please don&rsquo;t reply to it.
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
"""


IGNORE = "If you didn&rsquo;t {what}, you can safely ignore this email. {result}"

TEMPLATES = {
    "confirmation": dict(
        subject="Confirm your email to get started with Stiver",
        title="Confirm your email",
        pre="One tap and your Stiver account is ready.",
        heading="Confirm your email",
        body=lambda: p("Welcome to Stiver! Confirm that <strong>{{ .Email }}</strong> is yours to start tracking your spending, budgets and net worth.", top=18)
        + button("Confirm my email")
        + p("Opened this on your phone? No problem. If you were signing up on your computer, it will sign you in automatically.", muted=True, size=14, top=14)
        + fallback_link()
        + '<hr class="divider" style="border:0;border-top:1px solid #E7E8F5;margin:28px 0 20px;">'
        + p(IGNORE.format(what="create a Stiver account", result="No account will be activated."), muted=True, size=13, top=0),
    ),
    "recovery": dict(
        subject="Reset your Stiver password",
        title="Reset your password",
        pre="Choose a new password for your Stiver account.",
        heading="Reset your password",
        body=lambda: p("We received a request to reset the password for your Stiver account (<strong>{{ .Email }}</strong>). Tap the button to choose a new one.", top=18)
        + button("Choose a new password")
        + p("For your security, this link works once and expires soon.", muted=True, size=14, top=14)
        + fallback_link()
        + '<hr class="divider" style="border:0;border-top:1px solid #E7E8F5;margin:28px 0 20px;">'
        + p(IGNORE.format(what="ask for this", result="Your password stays exactly as it is."), muted=True, size=13, top=0),
    ),
    "magic_link": dict(
        subject="Your Stiver sign-in link",
        title="Sign in to Stiver",
        pre="Tap to sign in. No password needed.",
        heading="Sign in to Stiver",
        body=lambda: p("Use the button below to sign in as <strong>{{ .Email }}</strong>. No password needed.", top=18)
        + button("Sign in to Stiver")
        + p("This link works once and expires soon.", muted=True, size=14, top=14)
        + fallback_link()
        + '<hr class="divider" style="border:0;border-top:1px solid #E7E8F5;margin:28px 0 20px;">'
        + p(IGNORE.format(what="try to sign in", result="Nobody can get in without this link."), muted=True, size=13, top=0),
    ),
    "email_change": dict(
        subject="Confirm your new Stiver email address",
        title="Confirm your new email",
        pre="Confirm the new address for your Stiver account.",
        heading="Confirm your new email",
        body=lambda: p("You asked to change the email on your Stiver account from <strong>{{ .Email }}</strong> to <strong>{{ .NewEmail }}</strong>. Confirm the change to finish.", top=18)
        + button("Confirm new email")
        + fallback_link()
        + '<hr class="divider" style="border:0;border-top:1px solid #E7E8F5;margin:28px 0 20px;">'
        + p(IGNORE.format(what="request this change", result="Your account keeps its current email. If you&rsquo;re worried someone else is using your account, change your password right away."), muted=True, size=13, top=0),
    ),
    "invite": dict(
        subject="You’ve been invited to Stiver",
        title="You’ve been invited to Stiver",
        pre="Accept your invitation and set up your account.",
        heading="You&rsquo;re invited to Stiver",
        body=lambda: p("You&rsquo;ve been invited to join Stiver, a simple way to track spending, budgets and net worth. Accept the invitation to set up your account as <strong>{{ .Email }}</strong>.", top=18)
        + button("Accept invitation")
        + fallback_link()
        + '<hr class="divider" style="border:0;border-top:1px solid #E7E8F5;margin:28px 0 20px;">'
        + p(IGNORE.format(what="expect this invitation", result="No account will be created."), muted=True, size=13, top=0),
    ),
    "reauthentication": dict(
        subject="Your Stiver security code",
        title="Your security code",
        pre="Use this code to confirm it&rsquo;s you.",
        heading="Your security code",
        body=lambda: p("Enter this code in Stiver to confirm it&rsquo;s really you.", top=18)
        + code_block()
        + p("The code expires soon. Never share it with anyone. Stiver will never ask you for it.", muted=True, size=14, top=14)
        + '<hr class="divider" style="border:0;border-top:1px solid #E7E8F5;margin:28px 0 20px;">'
        + p(IGNORE.format(what="ask for this code", result="Consider changing your password to be safe."), muted=True, size=13, top=0),
    ),
}

where = {
    "confirmation": "Confirm sign up", "invite": "Invite user", "magic_link": "Magic link",
    "email_change": "Change email address", "recovery": "Reset password", "reauthentication": "Reauthentication",
}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    for key, t in TEMPLATES.items():
        (OUT / f"{key}.html").write_text(layout(t["title"], t["pre"], t["heading"], t["body"]()), encoding="utf-8")
        rows.append(f"| {where[key]} | `{t['subject']}` | `{key}.html` |")
    (OUT / "README.md").write_text(
        "# Email templates\n\n"
        "Generated by `python3 tools/build_email_templates.py`. Edit the script, not the HTML.\n\n"
        "Paste each file into **Supabase > Authentication > Emails > Templates** (open the template, set the subject, "
        "replace the message body with the file's HTML, save).\n\n"
        "| Supabase template | Subject | File |\n|---|---|---|\n" + "\n".join(rows) + "\n\n"
        "Variables used: `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}`, `{{ .Token }}`.\n"
        "Sender name/address are set under **Authentication > SMTP Settings** (e.g. Stiver, noreply@stiver.io).\n",
        encoding="utf-8")
    print("wrote", len(TEMPLATES), "templates to", OUT)
