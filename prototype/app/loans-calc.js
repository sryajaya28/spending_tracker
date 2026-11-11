'use strict';
/* Stiver app: savings, loans, lent money and net worth. Part of the former prototype/app.js; see docs/MAP.md. */
/* ---------- savings, loans and net worth (everything is compared in USD, shown in a chosen currency) ---------- */
const toUSD = (minor, c) => toMajor(minor, c) / RATES[c];
const savingsUSD = (k) => toUSD(balanceAtEnd(k), cur());
const activeLoans = () => D().loans.filter((l) => !l.archived);
const paidOf = (l, upto) => l.payments.filter((p) => p.kind !== 'charge' && (!upto || p.date <= upto)).reduce((a, p) => a + p.amount_minor, 0);
/* things paid with this loan as the account (expenses on a credit card...): they raise what is owed */
const chargedOf = (l, upto) => l.payments.filter((p) => p.kind === 'charge' && (!upto || p.date <= upto)).reduce((a, p) => a + p.amount_minor, 0);
/* a loan payment made from an account is an expense on that account (category Debt Payment), linked to the payment by payment.txn_id:
   the debt balance goes down, the account goes down, it counts as spending, and lists show only the account's record */
const repaymentOf = (txnId) => { for (const l of D().loans) { const p = l.payments.find((x) => x.txn_id === txnId && x.kind !== 'charge'); if (p) return { loan: l, payment: p }; } return null; };
function loanRepaymentCategory() {
  const d = D(); let c = d.categories.find((x) => !x.parent_id && x.type === 'expense' && x.name.trim().toLowerCase() === 'debt payment');
  if (!c) { const [n, type, icon, color] = CATS.find((x) => x[0] === 'Debt Payment'); c = { id: defaultCatId(n), parent_id: null, name: n, type, icon, color, archived: false }; d.categories.push(c); (SUBS[n] || []).forEach(([sn, sic]) => d.categories.push({ id: defaultCatId(n, sn), parent_id: c.id, name: sn, type, icon: sic, color, archived: false })); }
  return c;
}
/* money lent that comes back into a savings account: a single "transfer in" on that account (not income), category Lent Repayment, linked to the repayment by payment.txn_id */
const lentRepaymentOf = (txnId) => { for (const l of D().lent) { const p = l.payments.find((x) => x.txn_id === txnId); if (p) return { lent: l, payment: p }; } return null; };
/* money lent goes out of an account as a single transfer out (not spending), category Lent, linked to the lent record by lent.txn_id */
function lentCategory() {
  const d = D(); let c = d.categories.find((x) => x.id === defaultCatId('Lent')) || d.categories.find((x) => !x.parent_id && x.name.trim().toLowerCase() === 'lent');   // by id first: a renamed category is still the one (never a second row with the same id)
  if (!c) { const [n, type, icon, color] = CATS.find((x) => x[0] === 'Lent'); c = { id: defaultCatId(n), parent_id: null, name: n, type, icon, color, archived: false }; d.categories.push(c); }
  return c;
}
const lentOfTxn = (txnId) => D().lent.find((l) => l.txn_id === txnId);
function lentRepaymentCategory() {
  const d = D(); let c = d.categories.find((x) => x.id === defaultCatId('Lent Repayment')) || d.categories.find((x) => !x.parent_id && x.name.trim().toLowerCase() === 'lent repayment');   // by id first: a renamed category is still the one (never a second row with the same id)
  if (!c) { const [n, type, icon, color] = CATS.find((x) => x[0] === 'Lent Repayment'); c = { id: defaultCatId(n), parent_id: null, name: n, type, icon, color, archived: false }; d.categories.push(c); }
  return c;
}
/* the current cycle of a loan or card: whenever the running balance reaches zero (paid off), the next charges start a fresh cycle.
   base = what was owed when this cycle began (the original amount, or 0 after a payoff); the card shows paid / (base + charged) of THIS cycle only,
   so a paid-off card that is used again says "0% paid" of the new amount. */
function loanCycle(l, upto) {
  const day = upto || todayIso(), ev = l.payments.filter((p) => p.date <= day).sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'charge' ? -1 : 0) - (b.kind === 'charge' ? -1 : 0));
  let run = l.original_minor, base = l.original_minor, paid = 0, charged = 0, closed = null;
  ev.forEach((p) => {
    if (p.kind === 'charge') { run += p.amount_minor; charged += p.amount_minor; }
    else { run -= p.amount_minor; paid += p.amount_minor; if (run <= 0) { closed = { base, paid, charged }; run = 0; base = 0; paid = 0; charged = 0; } }   // paid off: the cycle ends here, a new one starts with the next charge
  });
  if (closed && !base && !paid && !charged) ({ base, paid, charged } = closed);   // paid off and not used again yet: still show that finished cycle (100% paid)
  return { base, paid, charged, total: base + charged, balance: Math.max(0, base + charged - paid) };
}
const loanBalance = (l, upto) => Math.max(0, l.original_minor + chargedOf(l, upto || todayIso()) - paidOf(l, upto || todayIso()));   // payments dated later have not been made yet
const loanUSD = (k) => activeLoans().reduce((a, l) => (!liveIn(l.since, k) ? a : a + toUSD(loanBalance(l, [periodEnd(k), todayIso()].sort()[0]), l.currency)), 0);
/* money you lent out: shares the loan shape (original amount + payments received) but counts as an asset */
const activeLent = () => D().lent.filter((l) => !l.archived);
/* a lent record with a transfer counts from that transfer's exact date (the account balance drops that day), an older one from its month: with a period start day the month alone would count the receivable a period early */
const lentUSD = (k) => activeLent().reduce((a, l) => { const t = l.txn_id && D().transactions.find((x) => x.id === l.txn_id); return (t ? t.occurred_at > periodEnd(k) : !liveIn(l.since, k)) ? a : a + toUSD(loanBalance(l, [periodEnd(k), todayIso()].sort()[0]), l.currency); }, 0);
const typeLabel = (t) => __({ cash: 'Cash', bank: 'Bank', ewallet: 'E-wallet', card: 'Card', expense: 'Expense', income: 'Income', crypto: 'Crypto', stablecoin: 'Stablecoin', stock: 'Stock', etf: 'ETF', commodity: 'Commodity', cash: 'Cash', manual: 'Other' }[t] || t);
const LOAN_TYPES = { mortgage: 'Mortgage', car: 'Vehicle loan', bank: 'Bank Loan', card: 'Credit card', paylater: 'Paylater', personal: 'Personal loan', other: 'Other' };

/* mock of the AI tagging described in the plan: history match first, null when unsure */
function aiTag(note, type) {
  if (!D().profile.ai || !note) return null;
  const labeled = D().transactions.filter((t) => t.category_id && t.type === type && t.note);
  if (labeled.length < 30) return null;
  const norm = (x) => x.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const n = norm(note);
  const hits = labeled.filter((t) => norm(t.note) === n);
  if (hits.length < 3) return null;
  const counts = {};
  hits.forEach((t) => { counts[t.category_id] = (counts[t.category_id] || 0) + 1; });
  const [id, c] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return c / hits.length >= 0.8 ? { category_id: id, confidence: Math.min(0.99, (c / hits.length) * 0.95) } : null;
}

