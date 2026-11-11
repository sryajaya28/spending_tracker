'use strict';
/* Stiver app: the state object, save(). Part of the former prototype/app.js; see docs/MAP.md. */
const state = { data: null, real: null, auth: { status: 'loading', view: 'landing', email: '', notice: '', error: '' }, ui: { month: monthKey(new Date()), q: '', cat: '', wallet: '', catsOpen: false, openCats: new Set(), openDays: new Set(), archOpen: false } };
function loadPrices() { try { return JSON.parse(localStorage.getItem(PRICES_KEY)) || {}; } catch { return {}; } }
/* transactions are ordered newest date first and, on the same date, the latest entered first (created_at; the database sets it
   on insert and it is read back on load, new entries get the current time here) */
const byRecent = (a, b) => b.occurred_at.localeCompare(a.occurred_at) || (b.created_at || '').localeCompare(a.created_at || '');
function sortTxns(d = state.data) {
  if (!d || !d.transactions) return; const now = new Date().toISOString();
  d.transactions.forEach((t) => { if (!t.created_at) t.created_at = now; });
  d.transactions.sort(byRecent);
}
function save() {
  sortTxns();
  if (state.real) return;   // demo mode: nothing is saved or synced
  try { localStorage.setItem(PRICES_KEY, JSON.stringify(state.data.livePrices)); } catch { /* storage unavailable */ }
  Cloud.save(state.data);   // sends only what changed since the last save
}

