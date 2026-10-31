/* Public client config. The anon (publishable) key is meant to be public: row-level security in the
   database is what protects each user's data. Never put the service_role key or any secret here. */
window.STIVER = {
  SUPABASE_URL: 'https://ukoxkwxmkwtlihbutryc.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_pvHLAbOw-Q_qGKW4JTdhBA_h51EJPHC',
  // Cloudflare Turnstile site key (public). Leave empty until CAPTCHA is also enabled in Supabase, then paste it here.
  TURNSTILE_SITE_KEY: '',
  // Canonical address of the live app. Links in emails and Google sign-in return here, even when someone signed up
  // on the old *.vercel.app address. Must also be allowed under Supabase > Authentication > URL Configuration.
  SITE_URL: 'https://stiver.io',
  // Public contact address shown on the privacy policy and terms pages. Leave empty to show a generic line.
  CONTACT_EMAIL: '',
};
