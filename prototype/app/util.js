'use strict';
/* Stiver app. Signed-in users' data lives in Supabase (see cloud.js); the UI works on the in-memory
   object state.data and save() syncs changes. Money is kept in integer minor units, like the DB schema. */

/* ---------- utils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
// units of currency per 1 USD (mock; the real app reads these from the fx_rates table)
// (these are fallbacks: the live rates from /api/fx replace them on load; Frankfurter/ECB and open.er-api both carry INR and PHP)
const RATES = { IDR: 15500, USD: 1, EUR: 0.92, GBP: 0.79, SGD: 1.35, AUD: 1.5, JPY: 150, HKD: 7.8, CNY: 7.2, INR: 95, PHP: 63.7 };
const PRICES_KEY = 'stiver.prices.v1';   // last live prices, only to avoid a flash of 0 on load

/* Decimal places per currency, fixed here on purpose. Asking the browser (Intl) gives different answers on
   different devices (an iPhone says IDR has 2 decimals, desktop Chrome says 0), which made the same stored
   amount read 100 times smaller on a phone. Amounts are stored in minor units using these exponents. */
const ZERO_DECIMAL = new Set(['IDR', 'JPY', 'KRW', 'VND', 'CLP', 'UGX', 'XAF', 'XOF', 'PYG', 'RWF']);
const expOf = (cur) => (ZERO_DECIMAL.has(cur) ? 0 : 2);
/* each currency is written the way its own country writes it, whatever the app language is: Rp 1.234.567 and 1.234,50 for rupiah, $1,234.50 for dollars */
const NATIVE_LOCALE = { IDR: 'id-ID', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', SGD: 'en-US', AUD: 'en-US', JPY: 'en-US', HKD: 'en-US', CNY: 'en-US', INR: 'en-IN', PHP: 'en-PH' };   // en-IN groups digits the Indian way: ₹12,34,567
const nativeLocale = (cur) => NATIVE_LOCALE[cur] || locale();
const curFmt = (cur) => new Intl.NumberFormat(nativeLocale(cur), { style: 'currency', currency: cur, minimumFractionDigits: expOf(cur), maximumFractionDigits: expOf(cur) });
const toMinor = (major, cur) => Math.round(major * 10 ** expOf(cur));
const toMajor = (minor, cur) => minor / 10 ** expOf(cur);
/* rupiah is always written "Rp 1.234" with a (non-breaking) space, whatever the device's number formatting says */
const rpSpace = (str) => str.replace(/Rp[\s\u00a0]*(?=\d)/g, 'Rp\u00a0');
const money = (minor, cur) => rpSpace(curFmt(cur).format(toMajor(minor, cur)));
const convert = (minor, from, to) => (from === to ? minor : Math.round((toMajor(minor, from) / RATES[from]) * RATES[to] * 10 ** expOf(to)));
const usdToMinor = (usd, cur) => toMinor(usd * RATES[cur], cur);
/* short amounts for chart axes. Rupees are written the way Indian apps do: 45K, 1.5 L (lakh = 100,000), 2.3 Cr (crore = 10,000,000); the rest use the browser's compact style */
const compactInr = (x) => { const a = Math.abs(x), f = (v) => String(+v.toFixed(1)); return (x < 0 ? '−' : '') + (a >= 1e7 ? f(a / 1e7) + ' Cr' : a >= 1e5 ? f(a / 1e5) + ' L' : a >= 1e3 ? f(a / 1e3) + 'K' : f(a)); };
const compact = (minor, cur) => (cur === 'INR' ? compactInr(toMajor(minor, cur)) : new Intl.NumberFormat(nativeLocale(cur), { notation: 'compact', maximumFractionDigits: 1 }).format(toMajor(minor, cur)));
function moneyHtml(minor, cur) {
  return curFmt(cur).formatToParts(toMajor(minor, cur))
    .map((p) => (p.type === 'fraction' || p.type === 'decimal' ? `<span class="dim">${p.value}</span>` : esc(p.value))).join('').replace(/Rp[\s\u00a0]*(?=\d|<)/g, 'Rp\u00a0');
}

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
