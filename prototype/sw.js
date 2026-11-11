// App-shell cache. Never touches non-GET or cross-origin requests, and the prototype
// has no authenticated API responses to cache (the real app must not cache those).
const CACHE = 'stiver-shell-__BUILD__';
const SHELL = ['./', './index.html', './styles.css', './app.js', './app/util.js', './app/periods.js', './app/icons.js', './app/categories.js', './app/catalog.js', './app/seed.js', './app/state.js', './app/selectors.js', './app/portfolio-calc.js', './app/loans-calc.js', './app/ui-helpers.js', './app/charts.js', './app/views.js', './app/landing.js', './app/household.js', './app/activity.js', './app/dialogs.js', './app/transfers.js', './app/invest-dialogs.js', './app/trades.js', './app/recurring.js', './sample.js', './dropdown.js', './datepicker.js', './i18n.js', './i18n-id.js', './cloud.js', './config.js', './analytics.js', './vendor/posthog.js', './vendor/supabase.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // network-first so edits show up; fall back to cache when offline
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
