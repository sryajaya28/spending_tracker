'use strict';
/* Stiver app: boot. Runs last: language and theme, cloud init, handoff and join, live rates, the service worker. Everything else now lives in prototype/app/ (see docs/MAP.md). */
setLang(initialLang()); applyTheme(initialTheme());
if (Cloud.configured) Cloud.init(onAuth, new Map(CATALOG.map((c) => [c[0], [c[1], c[2]]])), onSaveError);
else { Object.assign(state.auth, { status: 'out', error: 'The app is not connected to Supabase (missing config).' }); render(); }
consumeHandoffFromUrl();
joinBoot();
/* live fiat rates replace the demo ones (works without a Finnhub key; falls back silently) */
getJSON(`/api/fx?currencies=${Object.keys(RATES).join(',')}`).then((fx) => {
  Object.assign(RATES, fx.rates); api.fx = { source: fx.source, date: fx.date };
  if (D()) render();
}).catch(() => { /* keep the built-in demo rates */ });
getJSON('/api/status').then((s) => {
  api.finnhub = !!s.finnhub; api.yahoo = !!s.yahoo;
  if ((api.finnhub || api.yahoo) && D()) refreshPrices(true); // pull current prices once per page load
}).catch(() => { /* static hosting: no proxy, built-in catalog only */ });
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
