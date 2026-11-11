'use strict';
/* Stiver app: sample data: a demo mode, not saved data; switching it on and off and removing the sample. Part of the former prototype/app.js; see docs/MAP.md. Top-level names: DEMO_KEY, demoWanted, setDemo, demoBar, removeSample. */
/* ---------- sample data: a demo mode, not saved data ----------
   Turning it on swaps in a ready-made demo account (wallets, transactions, budgets, a portfolio, loans) in memory.
   Your own data is kept aside untouched, and nothing you do while the demo is on is saved or synced.
   Turning it off brings your own data back. The choice is remembered on this device. */
const DEMO_KEY = 'stiver.demo.v1';
const demoWanted = () => { try { return localStorage.getItem(DEMO_KEY) === '1'; } catch { return false; } };
async function setDemo(on) {
  if (on === !!state.real || !state.data) return;
  if (on) {
    await Cloud.idle();   // let any pending save of your own data finish first
    const own = state.data, d = seed(own.profile.name || 'You', own.profile.currency);
    d.profile = { ...own.profile, sample: null, period: 25 }; d.livePrices = own.livePrices || {};
    state.real = own; state.data = d;
  } else { state.data = state.real; state.real = null; }
  try { localStorage.setItem(DEMO_KEY, on ? '1' : '0'); } catch { /* storage unavailable */ }
  Object.assign(state.ui, { pf: null, pfTab: 'savings', cat: '', wallet: '', occ: '', q: '' });
  render();
}
const demoBar = () => `<div class="demo-bar" role="status"><span class="demo-long">${__("🧪 You're viewing {sample}. Your own data is safe, and changes made here aren't saved.", { sample: '<b>' + __('sample data') + '</b>' })}</span><span class="demo-short">🧪 <b>${__('Sample data')}</b> · ${__("not saved")}</span><button class="btn secondary" data-act="demo-off">${__('Back to my data')}</button></div>`;
function removeSample() {
  const d = D(), smp = d.profile.sample; if (!smp) return;
  const is = (k, id) => (smp[k] || []).includes(id);
  d.transactions = d.transactions.filter((t) => !is('transactions', t.id));
  d.budgets = d.budgets.filter((b) => !is('budgets', b.id));
  d.loans = d.loans.filter((l) => !is('loans', l.id)); d.lent = d.lent.filter((l) => !is('lent', l.id));
  d.holdings = d.holdings.filter((h) => !is('holdings', h.id));
  // things the sample created that you have since used stay (a wallet or category your own transactions point to)
  const usedWallets = new Set(d.transactions.map((t) => t.wallet_id)), usedCats = new Set([...d.transactions.map((t) => t.category_id), ...d.budgets.map((b) => b.category_id)].filter(Boolean));
  const usedAcc = new Set(d.holdings.map((h) => h.account_id));
  let kept = 0;
  d.wallets = d.wallets.filter((w) => { if (!is('wallets', w.id)) return true; if (usedWallets.has(w.id)) { kept++; return true; } return false; });
  d.investments = d.investments.filter((a) => { if (!is('investments', a.id)) return true; if (usedAcc.has(a.id)) { kept++; return true; } return false; });
  const keepCat = (c) => usedCats.has(c.id) || d.categories.some((k) => k.parent_id === c.id && (usedCats.has(k.id)));
  d.categories = d.categories.filter((c) => { if (!is('categories', c.id)) return true; if (keepCat(c)) { kept++; return true; } return false; });
  d.profile.sample = null;
  save(); render(); toast(kept ? __(kept === 1 ? 'Sample data removed. Kept {n} item you have since used.' : 'Sample data removed. Kept {n} items you have since used.', { n: kept }) : 'Sample data removed.');
}
