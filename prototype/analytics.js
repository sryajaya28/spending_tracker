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
  const route = () => location.hash.split('?')[0].split('/')[1] || 'overview';
  const pageName = () => (identified ? route() : 'landing');
  /* every event name and property key is snake_case (PostHog's own $-prefixed names are left alone); code-name values such as add-txn become add_txn */
  const snake = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[-\s]+/g, '_').toLowerCase();
  const snakeVal = (v) => (typeof v === 'string' ? v.replace(/-/g, '_') : v);
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
          p.page = p.page || pageName(); p.lang = document.documentElement.lang || 'en'; p.theme = document.documentElement.dataset.theme || 'light'; p.viewport = window.innerWidth <= 700 ? 'mobile' : 'desktop';
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
      const out = {}; Object.keys(props || {}).forEach((k) => { out[k.startsWith('$') ? k : snake(k)] = snakeVal(props[k]); });
      try { ph.capture(name.startsWith('$') ? name : snake(name), out); } catch (e) { /* ignore */ }
    },
    /* one page view per page name (the first part of the address: "transactions", never a date or an id) */
    page() {
      if (!on || demoOn()) return;
      const name = pageName();
      if (name === lastPage) return;
      lastPage = name; this.track('$pageview', { page: name });
    },
    /* a pop-up opened (open() in app.js): the form kind is a fixed code name from the template, or "info" for read-only pop-ups */
    dialogOpened(html, wasOpen) {
      if (wasOpen) return;
      const m = /data-form="([a-z-]+)"/.exec(html || '');
      this.track('dialog_opened', { form: m ? m[1] : 'info' });
    },
    /* only coarse, non-identifying profile facts become person properties */
    person(profile) {
      if (!on || !profile || demoOn()) return;
      try { ph.setPersonProperties({ currency: profile.currency || null, language: profile.language || null, theme: profile.theme || null }); } catch (e) { /* ignore */ }
    },
    identify(id) { if (!on || !id) return; try { if (!identified || ph.get_distinct_id() !== id) ph.identify(id); identified = true; } catch (e) { /* ignore */ } },
    /* only after a person was identified: a signed-out visitor keeps one anonymous id for the whole visit */
    reset() { if (!on || !identified) return; identified = false; lastPage = null; try { ph.reset(); } catch (e) { /* ignore */ } },
  };

  /* ---- generic interaction events. They read fixed code names from the page (data-act and a short allow-list of data-*), never visible text, values or record ids ---- */
  if (on) {
    const SAFE_ATTRS = ['view', 'tab', 'side', 'type', 'kind', 'route', 'preset'];
    const SAFE_SETTINGS = ['currency', 'period', 'ai'];
    const dialogIsOpen = () => { const d = document.getElementById('dlg'); return !!(d && d.open); };
    document.addEventListener('click', (e) => {
      const t = e.target; if (!t || !t.closest) return;
      const el = t.closest('[data-act]');
      if (el) {
        const props = { action: el.dataset.act, element: el.tagName.toLowerCase(), in_dialog: dialogIsOpen() };
        SAFE_ATTRS.forEach((k) => { if (el.dataset[k] !== undefined) props[k] = el.dataset[k]; });
        window.Analytics.track('button_clicked', props);
        return;
      }
      const a = t.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (href.startsWith('#/')) window.Analytics.track('nav_clicked', { to: href.split('?')[0].split('/')[1] || 'overview' });
      else if (/^https?:/i.test(href)) { let host = ''; try { host = new URL(href).hostname; } catch (err) { /* ignore */ } window.Analytics.track('link_clicked', { host }); }
    }, true);
    document.addEventListener('submit', (e) => {
      const f = e.target; if (f && f.dataset && f.dataset.form) window.Analytics.track('form_submitted', { form: f.dataset.form, edit: !!f.dataset.id });
    }, true);
    document.addEventListener('change', (e) => {
      const t = e.target; if (!t || !t.matches) return;
      if (t.matches('[data-setting]') && SAFE_SETTINGS.includes(t.dataset.setting)) window.Analytics.track('setting_changed', { setting: t.dataset.setting, value: t.type === 'checkbox' ? !!t.checked : t.value });
      else if (t.matches('[data-lang]')) window.Analytics.track('setting_changed', { setting: 'language', value: t.value });
      else if (t.matches('select[data-filter]')) window.Analytics.track('filter_changed', { filter: t.dataset.filter, active: !!t.value });
      else if (t.matches('[data-bind="month"]')) window.Analytics.track('period_changed', { all_periods: t.value === 'all' });
      else if (t.matches('[data-bind="pfRange"]')) window.Analytics.track('range_changed', { range: t.value });
    }, true);
  }
})();
