/* Product analytics (PostHog Cloud EU). Privacy rules, do not weaken them:
   - events carry names and coarse labels only (a type, a page name): never amounts, names, notes, emails or ids of records;
   - the person is identified by the random account id only (no email, no name);
   - no autocapture, no session recording, no feature flags, no cookies (browser local storage only), Do Not Track is honoured;
   - web addresses are cut at "?" and "#" (sign-in links carry tokens there) before anything is sent;
   - nothing is sent from localhost, nor while the sample-data demo is on (unless forced).
   Events go through our own address /ingest (a Vercel rewrite to eu.i.posthog.com), so the CSP stays 'self'. */
(function () {
  const cfg = window.STIVER || {};
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !window.__ANALYTICS_TEST;
  const ph = window.posthog;
  const on = !!(cfg.POSTHOG_KEY && ph && ph.init && !local);
  let identified = false, lastPage = null;
  const scrub = (v) => (typeof v === 'string' ? v.split(/[?#]/)[0] : v);
  if (on) {
    try {
      ph.init(cfg.POSTHOG_KEY, {
        api_host: cfg.POSTHOG_HOST || '/ingest', ui_host: cfg.POSTHOG_UI_HOST || 'https://eu.posthog.com',
        defaults: '2025-05-24', persistence: 'localStorage', person_profiles: 'identified_only',
        autocapture: false, capture_pageview: false, capture_pageleave: false, disable_session_recording: true, disable_surveys: true,
        advanced_disable_flags: true, advanced_disable_feature_flags: true, save_campaign_params: false, respect_dnt: true,
        opt_out_useragent_filter: !!window.__ANALYTICS_TEST,
        before_send: (ev) => {
          if (!ev) return null;
          const p = ev.properties = ev.properties || {};
          Object.keys(p).forEach((k) => { if (/url|referrer|href|pathname/i.test(k)) p[k] = scrub(p[k]); });
          if (window.__ANALYTICS_TEST) (window.__phEvents = window.__phEvents || []).push({ event: ev.event, properties: p });
          return ev;
        },
      });
      ph.register({ env: cfg.ENV || 'production', app: 'stiver' });
    } catch (e) { /* analytics must never break the app */ }
  }
  /* a sample-data demo is not real use: the caller can still force an event (turning the demo on or off) */
  const demoOn = () => { try { return typeof state !== 'undefined' && !!state.real; } catch (e) { return false; } };
  window.Analytics = {
    enabled: on,
    track(name, props, force) {
      if (!on || (!force && demoOn())) return;
      try { ph.capture(name, props || {}); } catch (e) { /* ignore */ }
    },
    /* one page view per page name (the first part of the address: "transactions", never a date or an id) */
    page() {
      if (!on || demoOn()) return;
      const name = identified ? (location.hash.split('?')[0].split('/')[1] || 'overview') : 'landing';
      if (name === lastPage) return;
      lastPage = name; this.track('$pageview', { page: name });
    },
    identify(id) { if (!on || !id) return; try { if (!identified || ph.get_distinct_id() !== id) ph.identify(id); identified = true; } catch (e) { /* ignore */ } },
    /* only after a person was identified: a signed-out visitor keeps one anonymous id for the whole visit */
    reset() { if (!on || !identified) return; identified = false; lastPage = null; try { ph.reset(); } catch (e) { /* ignore */ } },
  };
})();
