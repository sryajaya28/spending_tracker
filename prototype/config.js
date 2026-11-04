/* Public client config. The anon (publishable) key is meant to be public: row-level security in the
   database is what protects each user's data. Never put the service_role key or any secret here. */
/* Two environments. Only the live app's own addresses use the production database; every other address (the staging site,
   the preview link of any branch, local runs) uses the staging database, so nothing you try before release can touch real data. */
(function () {
const PRODUCTION_HOSTS = ['stiver.io', 'www.stiver.io', 'spendingtracker-three.vercel.app', 'spendingtracker-suryajaya378-4429s-projects.vercel.app', 'spendingtracker-git-main-suryajaya378-4429s-projects.vercel.app'];
const PROD = PRODUCTION_HOSTS.includes(location.hostname);
window.STIVER = {
  SUPABASE_URL: PROD ? 'https://ukoxkwxmkwtlihbutryc.supabase.co' : 'https://cujmgyacxbcmltxfjkxo.supabase.co',
  SUPABASE_ANON_KEY: PROD ? 'sb_publishable_pvHLAbOw-Q_qGKW4JTdhBA_h51EJPHC' : 'sb_publishable_BFRR-eAyMNAJtX52EN0ydQ_Teb0Q71G',
  ENV: PROD ? 'production' : 'staging',
  // Cloudflare Turnstile site key (public). Leave empty until CAPTCHA is also enabled in Supabase, then paste it here.
  TURNSTILE_SITE_KEY: '',
  // Canonical address of the live app. Links in emails and Google sign-in return here, even when someone signed up
  // on the old *.vercel.app address. Must also be allowed under Supabase > Authentication > URL Configuration.
  SITE_URL: PROD ? 'https://stiver.io' : location.origin,
  // Public contact address shown on the privacy policy and terms pages. Leave empty to show a generic line.
  CONTACT_EMAIL: '',
  // PostHog Cloud EU project token (public by design, like the Supabase anon key). Events go through our own /ingest rewrite (vercel.json).
  POSTHOG_KEY: 'phc_vn3JVcm3krGACtE3b7ReFTVT8NLyp9D3Nn2LLo9AXvgq',
  POSTHOG_HOST: '/ingest',
  POSTHOG_UI_HOST: 'https://eu.posthog.com',
};
/* a small label on every hosted non-production copy, so nobody mistakes it for the live app (not shown on local runs) */
if (!PROD && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  document.addEventListener('DOMContentLoaded', function () {
    const t = document.createElement('div');
    t.textContent = 'Staging · test data';
    t.setAttribute('style', 'position:fixed;left:8px;bottom:84px;z-index:2147483000;background:#F5B800;color:#1F1B4E;font:600 11px system-ui,sans-serif;padding:3px 8px;border-radius:10px;opacity:.92;pointer-events:none');
    document.body.appendChild(t);
  });
}
})();
