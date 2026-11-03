/* Public client config. The anon (publishable) key is meant to be public: row-level security in the
   database is what protects each user's data. Never put the service_role key or any secret here. */
/* Two environments. The staging site (staging.stiver.io, or the Vercel address of the staging branch) talks to the staging
   database; everything else (stiver.io, local runs and the tests) keeps the production settings. */
(function () {
const STAGING = /^staging\.stiver\.io$|^spendingtracker-git-staging-/.test(location.hostname);
window.STIVER = {
  SUPABASE_URL: STAGING ? 'https://cujmgyacxbcmltxfjkxo.supabase.co' : 'https://ukoxkwxmkwtlihbutryc.supabase.co',
  SUPABASE_ANON_KEY: STAGING ? 'sb_publishable_BFRR-eAyMNAJtX52EN0ydQ_Teb0Q71G' : 'sb_publishable_pvHLAbOw-Q_qGKW4JTdhBA_h51EJPHC',
  ENV: STAGING ? 'staging' : 'production',
  // Cloudflare Turnstile site key (public). Leave empty until CAPTCHA is also enabled in Supabase, then paste it here.
  TURNSTILE_SITE_KEY: '',
  // Canonical address of the live app. Links in emails and Google sign-in return here, even when someone signed up
  // on the old *.vercel.app address. Must also be allowed under Supabase > Authentication > URL Configuration.
  SITE_URL: STAGING ? 'https://staging.stiver.io' : 'https://stiver.io',
  // Public contact address shown on the privacy policy and terms pages. Leave empty to show a generic line.
  CONTACT_EMAIL: '',
};
})();
