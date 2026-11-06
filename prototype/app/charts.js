'use strict';
/* Stiver app: charts, wallet and loan cards, asset view, portfolio view, debt plans. Part of the former prototype/app.js; see docs/MAP.md. */
/* ---------- charts (hand-built SVG) ---------- */
function flowChart(months, inc, exp) {
  const W = 560, H = 260, pl = 46, pr = 18, pt = 14, pb = 30;
  const raw = Math.max(...inc, ...exp, 1);
  const base = 10 ** Math.floor(Math.log10(raw / 4));
  const max = 4 * base * ([1, 1.5, 2, 2.5, 5, 10].find((m) => m * base >= raw / 4) || 10);
  const x = (i) => pl + ((W - pl - pr) * i) / (months.length - 1);
  const y = (v) => pt + (H - pt - pb) * (1 - v / max);
  const line = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line(inc)} ${[...exp].map((v, i) => [x(i), y(v)]).reverse().map(([a, b]) => `L${a.toFixed(1)},${b.toFixed(1)}`).join(' ')} Z`;
  const ticks = [0, 1, 2, 3, 4].map((i) => (max * i) / 4);
  return `<div class="chart-wrap" id="flow" data-n="${months.length}">
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${__('Income versus spending by month')}">
      ${ticks.map((t) => `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" style="stroke:var(--line)"/><text x="${pl - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" style="fill:var(--muted)">${esc(compact(t, cur()))}</text>`).join('')}
      <path d="${area}" fill="#8B8FF0" fill-opacity=".16"/>
      <path d="${line(inc)}" fill="none" stroke="#4A44C6" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="${line(exp)}" fill="none" stroke="#F5B800" stroke-width="2.5" stroke-linejoin="round"/>
      ${months.map((k, i) => `<circle cx="${x(i)}" cy="${y(inc[i])}" r="4" fill="#4A44C6"/><circle cx="${x(i)}" cy="${y(exp[i])}" r="4" fill="#F5B800"/><text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" style="fill:var(--muted)">${monthLabel(k, 'short')}</text>`).join('')}
      <line id="flow-cursor" x1="0" x2="0" y1="${pt}" y2="${H - pb}" style="stroke:var(--ink)" stroke-width="1.5" opacity="0"/>
    </svg><div class="tip" id="flow-tip"></div></div>
    <div class="legend-row" style="margin-top:10px"><span><i style="background:#4A44C6"></i>${__('Income')}</span><span><i style="background:#F5B800"></i>${__('Spending')}</span></div>`;
}
function bindFlow(months, inc, exp) {
  const wrap = $('#flow'); if (!wrap) return;
  const svg = $('svg', wrap), tip = $('#flow-tip'), cur$ = $('#flow-cursor');
  const W = 560, pl = 46, pr = 18;
  svg.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(months.length - 1, Math.round(((vx - pl) / (W - pl - pr)) * (months.length - 1))));
    const cx = pl + ((W - pl - pr) * i) / (months.length - 1);
    cur$.setAttribute('x1', cx); cur$.setAttribute('x2', cx); cur$.setAttribute('opacity', 1);
    const net = inc[i] - exp[i], line = (dot, label, v) => `<div><span><i style="background:${dot}"></i>${label}</span><b class="num">${v}</b></div>`;
    tip.innerHTML = `<div class="tip-h">${esc(monthLabel(months[i], 'short'))}</div>${line('#A5A8FF', __('Income'), '+' + money(inc[i], cur()))}${line('#F5B800', __('Spending'), '−' + money(exp[i], cur()))}${line('#fff', __('Net'), (net >= 0 ? '+' : '−') + money(Math.abs(net), cur()))}`;
    const half = tip.offsetWidth / 2 + 4;
    tip.style.left = `${Math.max(half, Math.min(r.width - half, (cx / W) * r.width))}px`; tip.style.top = '4px'; tip.style.opacity = 1;
  });
  svg.addEventListener('pointerleave', () => { tip.style.opacity = 0; cur$.setAttribute('opacity', 0); });
}

function halfDonut(items, total) {
  // a donut: one arc per category (top 5 + Others). Hover (mouse) or tap shows name, amount and share in the centre.
  const cx = 130, R = 100, SW = 40, C = 2 * Math.PI * R, GAP = 3;
  const top = items.slice(0, 5), rest = items.slice(5).reduce((a, i) => a + i.value, 0);
  const parts = rest ? [...top, { name: __('Others'), color: '#CBD0E8', value: rest }] : top;
  let acc = 0;
  const arcs = total ? parts.map((p, i) => {
    const f = p.value / total, len = Math.max(f * C - (parts.length > 1 ? GAP : 0), 0.5), off = -acc * C; acc += f;
    const pct = f * 100, pctTxt = pct > 0 && pct < 1 ? '<1%' : pct.toLocaleString(locale(), { maximumFractionDigits: 1 }) + '%';
    return `<circle class="dseg" cx="${cx}" cy="${cx}" r="${R}" fill="none" stroke="${p.color}" stroke-width="${SW}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${cx} ${cx})" data-name="${esc(p.name)}" data-amt="${esc(money(p.value, cur()))}" data-pct="${pctTxt}" data-color="${p.color}" tabindex="0" role="img" aria-label="${esc(p.name)}: ${esc(money(p.value, cur()))}, ${pctTxt}"/>`;
  }).join('') : `<circle cx="${cx}" cy="${cx}" r="${R}" fill="none" stroke="#E6E8F5" stroke-width="${SW}"/>`;
  const dflt = `<p>${__('Spent in {month}', { month: esc(periodName(state.ui.month)) })}</p><b class="num" style="--len:${money(total, cur()).length}">${money(total, cur())}</b>`;
  const legend = total ? `<div class="legend-row donut-legend">${parts.map((p) => `<span><i style="background:${p.color}"></i>${p.icon ? p.icon + ' ' : ''}${esc(p.name)}</span>`).join('')}</div>` : '';   // same colours and order as the arcs
  return `<div class="donut"><svg viewBox="0 0 260 260" class="chart" role="group" aria-label="${__('Spending by category')}">${arcs}</svg>
    <div class="center" data-default="${esc(dflt)}">${dflt}</div></div>${legend}`;
}
// centre readout for the donut: hover on a mouse, tap to pin on touch; tap the same arc or anywhere else to clear
function donutShow(seg) {
  const wrap = seg.closest('.donut'), c = $('.center', wrap), svg = $('svg', wrap);
  $$('.dseg', wrap).forEach((x) => x.classList.toggle('on', x === seg));
  svg.classList.add('has-sel');
  const amt = seg.dataset.amt;
  c.innerHTML = `<p><i style="background:${seg.dataset.color}"></i>${seg.dataset.name}</p><b class="num" style="--len:${amt.length}">${amt}</b><p class="pct">${seg.dataset.pct} ${__('of total spending')}</p>`;
}
function donutReset(wrap) {
  if (!wrap || wrap.dataset.pinned) return;
  $$('.dseg', wrap).forEach((x) => x.classList.remove('on')); $('svg', wrap).classList.remove('has-sel');
  const c = $('.center', wrap); c.innerHTML = c.dataset.default;
}
document.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse') { const g = e.target.closest('.dseg'); if (g && !g.closest('.donut').dataset.pinned) donutShow(g); } });
document.addEventListener('pointerout', (e) => { if (e.pointerType === 'mouse' && e.target.closest && e.target.closest('.dseg')) donutReset(e.target.closest('.donut')); });
document.addEventListener('click', (e) => {
  const g = e.target.closest && e.target.closest('.dseg');
  $$('.donut[data-pinned]').forEach((w) => { if (!g || g.closest('.donut') !== w || g.classList.contains('on')) { delete w.dataset.pinned; donutReset(w); } });
  if (g && !g.closest('.donut').dataset.pinned) { g.closest('.donut').dataset.pinned = '1'; donutShow(g); }
});
document.addEventListener('focusin', (e) => { const g = e.target.closest && e.target.closest('.dseg'); if (g) donutShow(g); });
/* the icon row shows only while the icon field is active: it opens on focus and closes when focus moves elsewhere
   (tapping an icon in the row keeps the field focused, see the pointerdown handler) */
const iconPicksOf = (inp) => inp.form && inp.form.querySelector(`.icon-picks[data-for="${inp.name}"]`);
document.addEventListener('focusin', (e) => { if (e.target.classList?.contains('icon-input')) { iconPicksOf(e.target)?.classList.add('open'); const at = e.target.value; setTimeout(() => { if (e.target.value === at && document.activeElement === e.target) e.target.select(); }, 0); } });   // typing or an emoji replaces the current icon
document.addEventListener('focusout', (e) => { if (e.target.classList?.contains('icon-input')) { const row = iconPicksOf(e.target); if (row && !row.contains(e.relatedTarget)) row.classList.remove('open'); } });
document.addEventListener('pointerdown', (e) => { if (e.target.closest?.('.icon-pick')) e.preventDefault(); });   // keep the focus (and the keyboard state) on the icon field

function valueChart(months, usd, vc, o = {}) {
  const W = 560, H = 250, pl = 58, pr = 18, pt = 14, pb = 30, id = o.id || 'pf';   // o.neg: a series that can go below zero (profit & loss), o.id: a second chart on the same page
  const vals = usd.map((u) => u * RATES[vc]);
  const lo = o.neg ? Math.min(0, ...vals) : Math.min(...vals), hi = o.neg ? Math.max(0, ...vals) : Math.max(...vals), pad = (hi - lo) * 0.18 || Math.abs(hi) * 0.1 || 1;
  const min = o.neg ? lo - pad : Math.max(0, lo - pad), max = hi + pad;
  const x = (i) => pl + ((W - pl - pr) * i) / (months.length - 1);
  const y = (v) => pt + (H - pt - pb) * (1 - (v - min) / (max - min));
  const cmp = (v) => new Intl.NumberFormat(locale(), { notation: 'compact', maximumFractionDigits: 1 }).format(v);
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ticks = [0, 1, 2, 3].map((i) => min + ((max - min) * i) / 3);
  return `<div class="chart-wrap" id="${id}"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${__('Portfolio value by month')}">
    <defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A44C6" stop-opacity=".25"/><stop offset="1" stop-color="#4A44C6" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map((t) => `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" style="stroke:var(--line)"/><text x="${pl - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" style="fill:var(--muted)">${cmp(t)}</text>`).join('')}
    <path d="${line} L${x(vals.length - 1)},${H - pb} L${x(0)},${H - pb} Z" fill="url(#${id}g)"/>
    <path d="${line}" fill="none" stroke="#4A44C6" stroke-width="2.5" stroke-linejoin="round"/>
    ${vals.map((v, i) => { const step = Math.ceil(months.length / 6), last = months.length - 1, show = i === last || (i % step === 0 && last - i >= step / 2), lbl = months.length > 12 ? new Date(+months[i].slice(0, 4), +months[i].slice(5, 7) - 1, 1).toLocaleDateString(locale(), { month: 'short', year: '2-digit' }) : monthLabel(months[i], 'short'); return (months.length <= 14 || i === last ? `<circle cx="${x(i)}" cy="${y(v)}" r="4.5" fill="#4A44C6"/>` : '') + (show ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" style="fill:var(--muted)">${lbl}</text>` : ''); }).join('')}
    <line id="${id}-cursor" x1="0" x2="0" y1="${pt}" y2="${H - pb}" style="stroke:var(--ink)" stroke-width="1.5" opacity="0"/></svg><div class="tip" id="${id}-tip"></div></div>`;
}
function bindValue(months, usd, vc, o = {}) {
  const id = o.id || 'pf', wrap = $('#' + id); if (!wrap) return;
  const svg = $('svg', wrap), tip = $('#' + id + '-tip'), cursor = $('#' + id + '-cursor'), W = 560, pl = 58, pr = 18;
  svg.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect(), vx = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(months.length - 1, Math.round(((vx - pl) / (W - pl - pr)) * (months.length - 1))));
    const cx = pl + ((W - pl - pr) * i) / (months.length - 1);
    cursor.setAttribute('x1', cx); cursor.setAttribute('x2', cx); cursor.setAttribute('opacity', 1);
    const mom = i && usd[i - 1] > 0 ? ((usd[i] - usd[i - 1]) / usd[i - 1]) * 100 : null, mon = new Date(+months[i].slice(0, 4), +months[i].slice(5, 7) - 1, 1).toLocaleDateString(locale(), { month: 'short', year: 'numeric' });
    tip.textContent = o.neg ? `${mon}: ${usd[i] >= 0 ? '+' : '−'}${money(usdToMinor(Math.abs(usd[i]), vc), vc)}` : `${mon}: ${money(usdToMinor(usd[i], vc), vc)} (${pctFmt(mom)} MoM)`;
    tip.style.left = `${(cx / W) * r.width}px`; tip.style.top = `${r.height * 0.3}px`; tip.style.opacity = 1;
  });
  svg.addEventListener('pointerleave', () => { tip.style.opacity = 0; cursor.setAttribute('opacity', 0); });
}

function holdingRow(h, vc, accTotal) {
  const info = assetInfo(h.symbol), k = lastMonths(6)[5], price = info.usd(k), value = heldNow(h) * price;
  // name and "quantity SYMBOL"; value and share on the right. The price and actions are in the detail (tap a row).
  return `<div class="row holding-row" data-act="edit-holding" data-id="${h.id}" tabindex="0"><span class="tile sym" style="--c:${TYPE_COLOR[info.type]}">${esc(info.symbol.slice(0, 4))}</span>
    <div class="h-main"><div class="title h-name">${esc(info.name)}</div><div class="sub num">${qtyFmt(heldNow(h), h)} ${esc(info.symbol)}</div></div>
    <div class="amt num${info.cash ? ' amt-mid' : ''}">${money(usdToMinor(value, vc), vc)}${info.cash ? '' : `<div class="sub">${rowTail(h, value, accTotal)}</div>`}</div></div>`;
}
/* under the value: profit or loss against your cost when it is known, otherwise the share of the account */
function rowTail(h, value, accTotal) {
  const pl = pnlOf(h);
  if (pl && pl.pct != null) return `<span class="pl ${pl.pnl >= 0 ? 'up' : 'down'}">${pctText(pl.pct)}</span>`;
  return `${accTotal ? Math.round((value / accTotal) * 100) : 0}%`;
}

/* archived wallets: hidden from totals; can be restored, or deleted for good when no transaction uses them */
function archivedWallets() {
  const list = D().wallets.filter((w) => w.archived); if (!list.length) return '';
  const open = state.ui.archOpen;
  return `<div style="margin-top:18px"><button type="button" class="legend-btn card-toggle" data-act="toggle-arch" aria-expanded="${open}"><span class="chev" aria-hidden="true">›</span><b>${__('Archived accounts ({n})', { n: list.length })}</b></button>
    ${open ? list.map((w) => { const n = D().transactions.filter((t) => t.wallet_id === w.id).length;
      return `<div class="brow wrap">${tile({ icon: '👛', color: '#94A3B8' })}<div><b>${esc(w.name)}</b> <span class="badge">${esc(typeLabel(w.type))} · ${esc(w.currency)}</span><br><small class="muted">${money(walletBalance(w), w.currency)} · ${n} transaction${n === 1 ? '' : 's'}</small>${byLine(w)}</div>
        <div class="tools"><button class="btn secondary" data-act="restore-wallet" data-id="${w.id}">${__('Restore')}</button><button class="btn danger" data-act="delete-wallet" data-id="${w.id}">${__('Delete')}</button></div></div>`; }).join('') : ''}</div>`;
}
/* every list on Portfolio is sorted from the highest amount (compared in one currency) */
const byValue = (val) => (a, b) => val(b) - val(a);
const walletCard = (w) => {
  const open = state.ui.walletMenu === w.id;
  return `<div class="wallet"><div class="wtop"><div class="wtitle"><b class="wname">${esc(w.name)}</b><span class="kind">${esc(typeLabel(w.type))} · ${esc(w.currency)}</span></div>
    <div class="menu-wrap"><button type="button" class="dots" data-act="wallet-menu" data-id="${w.id}" aria-label="${__('More actions')}" aria-haspopup="menu" aria-expanded="${open}">⋯</button>
      ${open ? `<div class="menu" role="menu"><button type="button" role="menuitem" data-act="edit-wallet" data-id="${w.id}">${__('Edit')}</button><button type="button" role="menuitem" class="warn" data-act="archive-wallet" data-id="${w.id}">${__('Archive')}</button></div>` : ''}</div></div>
    <b class="num bal">${money(walletBalance(w), w.currency)}</b>${w.currency !== cur() ? `<small class="muted num">≈ ${money(convert(walletBalance(w), w.currency, cur()), cur())}</small>` : ''}</div>`;
};
/* the biggest 3 accounts show first; See more / Show less toggles the rest */
const walletCards = () => {
  const all = D().wallets.filter((w) => !w.archived).sort(byValue((w) => toUSD(walletBalance(w), w.currency))), more = !!state.ui.walletsMore, rest = all.length - 3;
  return all.map((w, i) => walletCard(w).replace('<div class="wallet"', i >= 3 ? '<div class="wallet more-item"' : '<div class="wallet"')).join('')
    + (rest > 0 ? `<button type="button" class="see-more" data-act="toggle-more" data-key="wallets" aria-expanded="${more}">${more ? __('Show less') : __('See more ({n})', { n: rest })}<span class="chev" aria-hidden="true">${more ? '⌃' : '⌄'}</span></button>` : '');
};


/* one card for both kinds: 'loan' = debt you owe, 'lent' = money others owe you */
function loanCard(l, vc, kind = 'loan') {
  const lent = kind === 'lent', coll = lent ? D().lent : D().loans;
  const bal = loanBalance(l), cyc = loanCycle(l), paid = cyc.paid, total = cyc.total, pct = total ? Math.min(100, Math.round((paid / total) * 100)) : 0;   // paid / total are for the current cycle (see loanCycle)
  const shown = (m) => money(convert(m, l.currency, vc), vc);
  const word = lent ? __('repayment') : __('payment');
  const meta = lent ? `${l.due ? __('Due {date}', { date: new Date(l.due + 'T00:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric' }) }) : __('No due date')}${l.note ? ` · ${esc(l.note)}` : ''}` : '';
  // a debt card is kept simple: the recurring payment (or the monthly payment set on the debt) and how long until it is paid off
  const plan = lent ? null : debtPlan(l), left = lent ? null : debtLeft(l, plan), wk = plan && plan.freq === 'weekly';
  const planText = plan ? `<b>${shown(plan.amount)}</b> ${wk ? __('every week') : __('every month')}` : '';
  const leftText = left ? (wk ? (left === 1 ? __('1 week left') : __('{n} weeks left', { n: left })) : (left === 1 ? __('1 month left') : __('{n} months left', { n: left }))) : '';
  const debtMeta = l.rate ? `${l.rate}% ${l.flat ? __('flat') : 'APR'}` : '';
  return `<section class="card${leftText ? ' has-tab' : ''}">${leftText ? `<span class="loan-tab">${leftText}</span>` : ''}<div class="card-head"><div><h2>${esc(l.name)} <span class="badge">${lent ? __('Lent') : esc(__(LOAN_TYPES[l.type] || 'Debt'))}</span></h2>${byLine(l)}
      <div class="big num" style="font-size:26px;margin-top:4px">${shown(bal)}</div>${l.currency !== vc ? `<small class="muted num">${money(bal, l.currency)} ${esc(l.currency)}</small>` : ''}</div>
      <div class="tools"><button class="btn secondary" data-act="edit-${kind}" data-id="${l.id}">${__('Edit')}</button><button class="btn secondary" data-act="history-${kind}" data-id="${l.id}">${__('Details')}</button><button class="btn" data-act="pay-${kind}" data-id="${l.id}">+ ${lent ? __('Repayment') : __('Payment')}</button></div></div>
    ${lent ? `<div class="bar"><i style="width:${pct}%;background:#1fa971"></i></div>
    <div class="loan-meta"><span>${__('{pct}% repaid · {paid} of {total}', { pct, paid: shown(paid), total: shown(total) })}</span><span>${meta}</span></div>`
      : (planText || debtMeta) ? `<div class="loan-meta"><span>${[planText, debtMeta].filter(Boolean).join(' · ')}</span></div>` : ''}
    ${bal === 0 ? `<p class="hint" style="margin-top:10px">${lent ? __('Fully repaid. You can archive this.') : __('Paid off. You can archive this.')}</p>` : ''}
</section>`;
}

/* an (i) button with a small popover: tap/click toggles it, hover shows it on desktop, tapping elsewhere closes it */
const infoTip = (id, text) => `<span class="info-wrap${state.ui.infoOpen === id ? ' open' : ''}"><button type="button" class="info-btn" data-act="toggle-info" data-id="${id}" aria-expanded="${state.ui.infoOpen === id}" aria-label="${__('Info')}">i</button><span class="info-pop" role="tooltip">${esc(text)}</span></span>`;
/* the full history page of one asset: summary, Buy/Sell (Deposit/Withdraw for cash), and every trade, transfer and income/expense in coins */
function viewAsset(h) {
  const info = assetInfo(h.symbol), acc = accountName(h.account_id);
  return `${topbar('Portfolio', esc(info.name) + ' · ' + esc(acc))}
  <section class="card"><div class="card-head"><div><a class="back-link" href="#/portfolio">← ${__('Back to Portfolio')}</a><h2>${esc(info.name)}</h2></div>
    <div class="tools"><button class="btn secondary" data-act="edit-holding" data-id="${h.id}">${__('Edit')}</button></div></div>
    ${holdingSummary(h, info, vcOf(h))}
    <div class="hold-actions"><button type="button" class="btn" data-act="trade" data-side="buy" data-id="${h.id}">${info.cash ? __('Deposit') : __('Buy')}</button><button type="button" class="btn secondary sell" data-act="trade" data-side="sell" data-id="${h.id}">${info.cash ? __('Withdraw') : __('Sell')}</button></div></section>
  <section class="card"><div class="card-head"><h2>${__('History')}</h2></div>${tradeList(h)}</section>`;
}
/* the reporting-currency dropdown, right next to the big amount */
/* flags for the currency lists (emoji: they show in the list, the chosen value stays the plain code) */
const CCY_FLAG = { IDR: '🇮🇩', USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', SGD: '🇸🇬', AUD: '🇦🇺', JPY: '🇯🇵', HKD: '🇭🇰', CNY: '🇨🇳', INR: '🇮🇳', PHP: '🇵🇭' };
const flagLabel = (c) => (CCY_FLAG[c] ? `${CCY_FLAG[c]}  ${c}` : c);
const heroCurrency = (base) => `<label class="hero-cur"><select data-setting="currency" ${hhLocked()} aria-label="${__('Preferred currency')}">${Object.keys(RATES).map((c) => `<option ${c === base ? 'selected' : ''} data-list="${flagLabel(c)}">${c}</option>`).join('')}</select></label>`;
/* realized profit and loss from selling assets, one entry per sale (computed from the trades, so sales made before the separate profit/loss records existed are included;
   assets whose cost is unknown are left out). Amounts are in the reporting currency. */
function realizedPnl() {
  const out = [];
  D().holdings.filter((h) => activeAccounts().some((a) => a.id === h.account_id) && trackCost(h)).forEach((h) => {
    const hc = holdingCost(h); if (!hc.known) return;
    h.trades.filter((t) => t.side === 'sell' && t.date <= todayIso()).forEach((t) => { const pi = hc.per[t.id]; if (pi && Number.isFinite(pi.realized) && Math.abs(pi.realized) > 1e-9) out.push({ date: t.date, symbol: assetInfo(h.symbol).symbol, qty: t.quantity, h, usd: pi.realized / RATES[hc.ccy], pnl: usdToMinor(pi.realized / RATES[hc.ccy], cur()) }); });
  });
  return out.filter((e) => e.pnl !== 0).sort((a, b) => b.date.localeCompare(a.date));
}
/* one month opened in place: each day's total and the sales behind it */
function pnlDays(list) {
  const days = new Map(), fmt = (d) => new Date(d + 'T00:00').toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' });
  list.forEach((e) => { (days.get(e.date) || days.set(e.date, []).get(e.date)).push(e); });
  const cnt = (n) => (n === 1 ? __('1 sale') : __('{n} sales', { n }));
  const ent = (e) => { const info = assetInfo(e.symbol); return `<div class="row"><span class="tile sym" style="--c:${TYPE_COLOR[info.type]}">${esc(info.symbol.slice(0, 4))}</span><div><div class="title">${esc(info.name)}</div><div class="sub num">${qtyFmt(e.qty, e.h)} ${esc(info.symbol)} ${__('sold')}${(() => { const ac = D().investments.find((x) => x.id === e.h.account_id); return ac ? ' · ' + esc(ac.name) : ''; })()}</div></div><div class="amt num">${pnlText(e.pnl)}</div></div>`; };
  return [...days.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([d, es]) => { const open = state.ui.openDays.has(d);
    return `<div class="day-group ${open ? 'open' : ''}" data-day="${d}"><div class="row day-row" data-act="toggle-day" data-id="${d}" tabindex="0" role="button" aria-expanded="${open}"><span class="daybox"><b>${+d.slice(8)}</b><small>${esc(new Date(d + 'T00:00').toLocaleDateString(locale(), { month: 'short' }))}</small></span>
    <div><div class="title">${esc(new Date(d + 'T00:00').toLocaleDateString(locale(), { weekday: 'long' }))}</div><div class="sub">${cnt(es.length)}</div></div>
    <div class="amt num">${pnlText(es.reduce((a, e) => a + e.pnl, 0))}</div><span class="day-chev" aria-hidden="true">›</span></div>
    <div class="day-body">${es.map(ent).join('')}</div></div>`; }).join('');
}
const pnlText = (v) => (v === 0 ? `<span class="pl">${money(0, cur())}</span>` : `<span class="pl ${v > 0 ? 'up' : 'down'}">${v > 0 ? '+' : '−'}${money(Math.abs(v), cur())}</span>`);
/* the Realized profit & loss section of the Investment tab: the same component as "Investment growth month over month" (range, chart, month rows, See more),
   with the net profit or loss of each month on the right (green +, red −); tapping a month opens its page (viewPnlMonth) with the days */
function pnlSection(rm, vc) {
  const all = realizedPnl(), m = (usd) => `${usd >= 0 ? '+' : '−'}${money(usdToMinor(Math.abs(usd), vc), vc)}`;
  const series = rm.map((k) => all.filter((e) => inPeriod(e.date, k)).reduce((a, e) => a + e.usd, 0));
  const head = `<div class="card-head"><h2>${__('Realized P&L')}</h2>${pfRangeSelect()}</div>`;
  state.chart2 = null;
  if (!all.length) return `<section class="card" style="margin-top:20px">${head}<div class="empty sm">${__('No sales yet. Profit and loss appear here when you sell an asset.')}</div></section>`;
  state.chart2 = { months: rm, series, vc };
  const rows = rm.map((k, i) => `<div class="mrow tap-row" data-act="pnl-month" data-k="${k}" tabindex="0" role="link"><span class="mname">${esc(new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString(locale(), { month: 'short', year: 'numeric' }))}</span><div class="mval"><b class="num pl ${usdToMinor(series[i], vc) === 0 ? '' : series[i] > 0 ? 'up' : 'down'}">${usdToMinor(series[i], vc) === 0 ? money(0, vc) : m(series[i])}</b></div></div>`).reverse();
  const more = !!state.ui.pnlhistMore, rest = rows.length - 3;
  const html = rows.map((r, i) => (i >= 3 ? r.replace('<div class="mrow tap-row"', '<div class="mrow tap-row more-item"') : r)).join('')
    + (rest > 0 ? `<button type="button" class="see-more" data-act="toggle-more" data-key="pnlhist" aria-expanded="${more}">${more ? __('Show less') : __('See more ({n})', { n: rest })}<span class="chev" aria-hidden="true">${more ? '⌃' : '⌄'}</span></button>` : '');
  return `<section class="card" style="margin-top:20px">${head}${valueChart(rm, series, vc, { id: 'pnl', neg: true })}<div class="mlist ${more ? '' : 'collapsed'}">${html}</div></section>`;
}
/* one month of realized profit and loss on its own page, day by day */
function viewPnlMonth(k) {
  const all = realizedPnl(), whole = k === 'all', list = whole ? all : all.filter((e) => inPeriod(e.date, k)), net = list.reduce((a, e) => a + e.pnl, 0);
  const keys = [...new Set([currentPeriod(), ...all.map((e) => periodKeyOf(e.date)), ...(whole ? [] : [k])])].sort().reverse();
  const pick = `<select class="chip pill-select" data-bind="pnlPeriod" aria-label="${__('Period')}"><option value="all" ${whole ? 'selected' : ''}>${__('All time')}</option>${keys.map((x) => `<option value="${x}" ${x === k ? 'selected' : ''}>${esc(periodHeading(x))}</option>`).join('')}</select>`;
  return `${topbar('Realized Profit & Loss')}
  <section class="card"><div class="card-head"><div><a class="back-link" href="#/portfolio">← ${__('Back to Portfolio')}</a></div>${pick}</div>
    <div class="big num" style="font-size:26px;margin:4px 0 12px">${pnlText(net)}</div>
    ${list.length ? pnlDays(list) : '<div class="empty">' + __('No sales in this period.') + '</div>'}</section>`;
}
function viewPortfolio() {
  const hid = routeArg(), ah = hid && D().holdings.find((x) => x.id === hid); if (ah) return viewAsset(ah);
  if (/^pnl-(\d{4}-\d{2}|all)$/.test(hid)) { state.chart = null; state.chart2 = null; return viewPnlMonth(hid.slice(4)); }
  const months = lastMonths(6), vc = pf(), base = cur(), tab = state.ui.pfTab || 'savings';
  const S = months.map(savingsUSD), I = months.map((k) => portfolioUSD(k)), L = months.map(loanUSD), LT = months.map(lentUSD);
  const N = months.map((_, i) => S[i] + I[i] + LT[i] - L[i]);
  const now = N[5], prev = N[4], mom = prev > 0 ? ((now - prev) / prev) * 100 : null;
  const m = (usd) => money(usdToMinor(usd, vc), vc);
  const assets = S[5] + I[5] + LT[5];
  const share = (v) => (assets > 0 ? Math.round((v / assets) * 100) : 0);
  const rm = pfMonths(), series = rm.map({ savings: savingsUSD, investment: (k) => portfolioUSD(k), lent: lentUSD, loan: loanUSD }[tab]);
  state.chart = { months: rm, series, vc };
  const titles = { savings: __('Savings over time'), investment: __('Investment growth'), lent: __('Money lent over time'), loan: __('Debt balance over time') };
  const months6 = rm.map((k, i) => {
    const d = i ? series[i] - series[i - 1] : null, p = i && series[i - 1] > 0 ? (d / series[i - 1]) * 100 : null;
    const good = p === null ? '' : (tab === 'loan' ? p <= 0 : p >= 0) ? 'up' : 'down';
    // a list, not a table: the value gets its own line, so figures of any size (hundreds of billions) never push other columns off screen
    const chg = d === null ? '—' : `${d >= 0 ? '+' : '−'}${m(Math.abs(d))}`;
    return `<div class="mrow"><span class="mname">${esc(new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString(locale(), { month: 'short', year: 'numeric' }))}</span><div class="mval"><b class="num">${m(series[i])}</b><small class="num">${chg}${p === null ? '' : ` · <span class="${good}">${pctFmt(p)}</span>`}</small></div></div>`;
  }).reverse();
  const histMore = !!state.ui.histMore, histRest = months6.length - 3;
  const histHtml = months6.map((r, i) => (i >= 3 ? r.replace('<div class="mrow">', '<div class="mrow more-item">') : r)).join('')
    + (histRest > 0 ? `<button type="button" class="see-more" data-act="toggle-more" data-key="hist" aria-expanded="${histMore}">${histMore ? __('Show less') : __('See more ({n})', { n: histRest })}<span class="chev" aria-hidden="true">${histMore ? '⌃' : '⌄'}</span></button>` : '');
  const noData = series.every((v) => !v);   // nothing to chart yet: say so instead of a flat line and a table of zeros
  const growth = noData ? `<section class="card" style="margin-top:20px"><div class="card-head"><h2>${titles[tab]}</h2>${pfRangeSelect()}</div>
    <div class="empty sm">${__('Nothing to chart yet. This fills in as you add {what}.', { what: { savings: __('accounts'), investment: __('investments'), lent: __('money you lent'), loan: __('debts') }[tab] })}</div></section>`
    : `<section class="card" style="margin-top:20px"><div class="card-head"><h2>${titles[tab]}</h2>${pfRangeSelect()}</div>
    ${valueChart(rm, series, vc)}<div class="mlist ${histMore ? '' : 'collapsed'}">${histHtml}</div></section>`;

  let body = '';
  if (tab === 'savings') {
    body = `<section class="card"><div class="card-head"><div><h2>${__('Savings accounts')}</h2><div class="big num" style="font-size:26px;margin-top:4px">${m(S[5])}</div></div><div class="tools"><button class="btn secondary" data-act="transfer">${__('Transfer')}</button><button class="btn" data-act="add-wallet">${__('+ Account')}</button></div></div>
      <div class="wallets ${state.ui.walletsMore ? '' : 'collapsed'}">${walletCards()}</div>${archivedWallets()}</section>${growth}`;
  } else if (tab === 'investment') {
    const byType = {};
    D().holdings.filter((h) => activeAccounts().some((a) => a.id === h.account_id)).forEach((h) => { const t = assetInfo(h.symbol).type; byType[t] = (byType[t] || 0) + holdingUSD(h, months[5]); });
    const alloc = Object.entries(byType).sort((a, b) => b[1] - a[1]);
    body = `<section class="card"><div class="card-head"><div><h2>${__('Investments')} ${infoTip('pf-prices', __('Prices and exchange rates update every 6 hours and can be delayed. Values are estimates, not financial advice.'))}</h2><div class="big num" style="font-size:26px;margin-top:4px">${m(I[5])}</div></div>
        <div class="tools"><button class="btn" data-act="add-account">${__('+ Account')}</button></div></div>
      ${alloc.length ? `<div class="alloc">${alloc.map(([t, v]) => `<i style="flex:${v};background:${TYPE_COLOR[t]}" title="${esc(t)}"></i>`).join('')}</div>
      <div class="alloc-legend">${alloc.map(([t, v]) => `<div><span class="key"><i style="background:${TYPE_COLOR[t]}"></i>${esc(t)}</span><b class="num">${m(v)}</b><span class="muted">${I[5] ? Math.round((v / I[5]) * 100) : 0}%</span></div>`).join('')}</div>` : `<div class="empty sm">${activeAccounts().length ? __('Add assets to an account to see your allocation.') : __('No investment accounts yet. Tap + Account to add one, for example your exchange or brokerage.')}</div>`}
</section>
      ${growth}
      ${pnlSection(rm, vc)}
      <div class="stack" style="margin-top:20px">${[...activeAccounts()].sort(byValue((a) => portfolioUSD(months[5], a.id))).map((a) => {
        const hs = [...holdingsOf(a.id)].sort(byValue((h) => holdingUSD(h, months[5]))), total = portfolioUSD(months[5], a.id);
        return `<section class="card"><div class="card-head acct-head"><div><h2>${esc(a.name)}</h2>${byLine(a)}<div class="big num" style="font-size:26px;margin-top:4px">${m(total)}</div></div>
          <div class="tools"><button class="btn secondary" data-act="edit-account" data-id="${a.id}">${__('Edit')}</button><button class="btn secondary" data-act="add-holding" data-account="${a.id}" data-type="cash">${__('+ Cash')}</button><button class="btn" data-act="add-holding" data-account="${a.id}">${__('+ Asset')}</button></div></div>
          <div class="list">${hs.map((h) => holdingRow(h, vc, total)).join('') || ('<div class="empty">' + __('No assets yet. Add one to start tracking.') + '</div>')}</div></section>`;
      }).join('')}</div>`;
  } else if (tab === 'lent') {
    const owed = activeLent().reduce((a, l) => a + toUSD(loanBalance(l), l.currency), 0);
    body = `<section class="card"><div class="card-head"><div><h2>${__('Money you lent')}</h2><div class="big num" style="font-size:26px;margin-top:4px">${m(LT[5])}</div>
        <small class="muted">${__('{n} open · {amount} still owed to you', { n: activeLent().length, amount: m(owed) })}</small></div><button class="btn" data-act="add-lent">${__('+ Lent')}</button></div></section>
      <div class="stack" style="margin-top:20px">${[...activeLent()].sort(byValue((l) => toUSD(loanBalance(l), l.currency))).map((l) => loanCard(l, vc, 'lent')).join('') || ('<div class="card empty">' + __('Nothing lent out. Add money you lent to a friend or family member to track repayments.') + '</div>')}</div>${growth}`;
  } else {
    body = `<section class="card"><div class="card-head"><div><h2>${__('Debts you owe')}</h2><div class="big num" style="font-size:26px;margin-top:4px">${m(L[5])}</div></div><div class="tools">${D().loans.some((l) => l.archived) ? `<button class="chip" data-act="loans-archived">${__('Archived')}</button>` : ''}<button class="btn" data-act="add-loan">${__('+ Debt')}</button></div></div></section>
      <div class="stack" style="margin-top:20px">${[...activeLoans()].sort(byValue((l) => toUSD(loanBalance(l), l.currency))).map((l) => loanCard(l, vc)).join('') || ('<div class="card empty">' + __('No debts. Add a mortgage, car loan or credit card balance to include it in your net worth.') + '</div>')}</div>${growth}`;
  }

  const tabBtn = (id, label) => `<button class="tab ${tab === id ? 'on' : ''}" data-act="pf-tab" data-tab="${id}">${__(label)}</button>`;
  return `${topbar('Portfolio', __('Net worth across savings, investments and debts · shown in {cur}', { cur: vc }))}
  <div class="grid">
    <section class="card hero"><div class="label">${__('Net worth')}</div>
      <div class="amount-line"><div class="amount num" style="--len:${m(now).length + 6}">${moneyHtml(usdToMinor(now, vc), vc)}</div>${heroCurrency(base)}</div>
      <div class="delta"><b>${pctFmt(mom)}</b><span>${__('vs last month')}</span></div></section>
    <section class="card"><div class="card-head"><h2>${__('Breakdown')}</h2></div>
      <div class="alloc-legend">
        <div><span class="key"><i style="background:#4A44C6"></i>${__('Savings')}</span><b class="num">${m(S[5])}</b><span class="muted">${share(S[5])}%</span></div>
        <div><span class="key"><i style="background:#F5B800"></i>${__('Investments')}</span><b class="num">${m(I[5])}</b><span class="muted">${share(I[5])}%</span></div>
        <div><span class="key"><i style="background:#1fa971"></i>${__('Lent to others')}</span><b class="num">${m(LT[5])}</b><span class="muted">${share(LT[5])}%</span></div></div>
      <div class="alloc-legend alloc-debt"><div><span class="key"><i style="background:#E5484D"></i>${__('Less: Debts')}</span><b class="num">−${m(L[5])}</b><span class="muted"></span></div></div></section>
  </div>
  <div class="tabs" role="tablist" style="margin:20px 0">${tabBtn('savings', 'Savings')}${tabBtn('loan', 'Debt')}${tabBtn('investment', 'Investment')}${tabBtn('lent', 'Lent')}</div>
  ${body}`;
}

/* the repeating payment of a debt (a recurring rule with spec.debt), paused or not */
const debtRuleAny = (l) => (D().recurring || []).find((r) => r.spec && r.spec.debt === l.id);
/* accounts a debt payment can be paid from: same currency as the debt; the first entry is "no account" */
function debtAccountOptions(currency, selected) {
  const ws = D().wallets.filter((w) => !w.archived && w.currency === currency);
  return `<option value="">${__('No account, just record the payment')}</option>${ws.map((w) => `<option value="${w.id}" ${w.id === selected ? 'selected' : ''}>${esc(w.name)} · ${money(walletBalance(w), w.currency)}</option>`).join('')}`;
}
function loanDialog(l) {
  const rule = l ? debtRuleAny(l) : null, freq = rule ? rule.freq : '', wk = freq === 'weekly', today = isoDate(new Date());
  const payMinor = rule ? rule.spec.amount_minor : l ? l.monthly_minor : 0, ccy = l ? l.currency : cur();
  const wsAll = D().wallets.filter((w) => !w.archived && w.currency === ccy), pickAcct = rule ? rule.spec.wallet_id : (recallAcct('repay', wsAll.map((w) => `<option value="${w.id}"></option>`).join('')) || (wsAll[0] ? wsAll[0].id : ''));
  const leftN = l && payMinor > 0 && loanBalance(l) > 0 ? debtN(loanBalance(l), payMinor, wk ? ((l.rate || 0) * 12) / 52 : l.rate, l.flat) : null;
  open(`<h2>${l ? __('Edit debt') : __('Add debt')}</h2><form data-form="loan" data-id="${l?.id || ''}" data-edited="${l ? 'monthly,amount' : ''}" style="display:contents">
    <label class="field">${__('Name')}<input name="name" required maxlength="40" value="${esc(l?.name || '')}" placeholder="${__('e.g. Vehicle loan')}"></label>
    <div class="two"><label class="field">${__('Type')}<select name="type">${Object.entries(LOAN_TYPES).map(([k, v]) => `<option value="${k}" ${k === (l?.type || 'car') ? 'selected' : ''}>${__(v)}</option>`).join('')}</select></label>
      <label class="field">${__('Currency')}<select name="currency" ${l ? 'disabled' : ''}>${Object.keys(RATES).map((c) => `<option ${c === (l?.currency || cur()) ? 'selected' : ''} data-list="${flagLabel(c)}">${c}</option>`).join('')}</select></label></div>
    <label class="field">${__('Amount owed now')}<input name="amount" type="number" inputmode="decimal" min="${l ? 0 : 1}" step="any" required value="${l ? toMajor(loanBalance(l), l.currency) : ''}"></label>
    <label class="field">${__('Repeat payment')}<select name="repeat">${REPEATS.map(([v, lb]) => `<option value="${v}" ${v === freq ? 'selected' : ''}>${__(lb)}</option>`).join('')}</select></label>
    <div data-rec style="display:${freq ? 'contents' : 'none'}">
      <div class="two"><label class="field"><span data-lbl-pay>${wk ? __('Weekly payment') : __('Monthly payment')}</span><input name="monthly" type="number" inputmode="decimal" min="0" step="any" value="${l && payMinor ? toMajor(payMinor, l.currency) : ''}"></label>
        <label class="field">${__('Next payment')}<input name="next" type="date" min="${today}" value="${rule ? rule.next : nthDate(today, 'monthly', 1)}"></label></div>
      <label class="field">${__('Paid from')}<select name="account">${debtAccountOptions(ccy, pickAcct)}</select></label>
      <label class="field"><span data-lbl-left>${wk ? __('Installments remaining (Weekly)') : __('Installments remaining (Monthly)')}</span><input name="left" type="number" inputmode="numeric" min="0" step="1" value="${leftN ?? ''}"></label>
    </div>
    <div class="two"><label class="field">${__('Interest rate (% per year, optional)')}<input name="rate" type="number" inputmode="decimal" min="0" step="any" value="${l?.rate || ''}"></label>
      <label class="field">${__('Interest type')}<select name="flat"><option value="0" ${l && !l.flat ? 'selected' : ''}>${__('Declining balance')}</option><option value="1" ${(l ? l.flat : true) ? 'selected' : ''}>${__('Flat rate')}</option></select></label></div>
    ${l ? `<p class="hint">${__('Type what you still owe today. Stiver keeps your payments and charges and adjusts the starting amount ({orig}) behind the scenes.', { orig: money(l.original_minor, l.currency) })}</p>` : ''}
    <div class="actions">${l ? `<button type="button" class="btn danger" data-act="archive-loan" data-id="${l.id}">${__('Archive')}</button>` : ''}<button class="btn" type="submit">${__('Save')}</button></div></form>`);
}
/* amount owed, monthly payment and installments remaining depend on each other: fill in two and the third follows.
   With an interest rate (per year) the usual loan formula is used (the interest is charged on what is still owed each month);
   without one it is plain division. The two boxes typed in last are the ones you meant; the other one is worked out */
const debtRate = (ratePct) => (ratePct > 0 ? ratePct / 1200 : 0);
function debtN(owed, pay, ratePct, flat) {   // payments left; null when the payment does not even cover the interest
  if (!(owed > 0 && pay > 0)) return null; const r = debtRate(ratePct);
  if (!r) return Math.max(1, Math.ceil(owed / pay - 1e-9));
  if (flat) { const room = pay - owed * r; return room > 1e-9 ? Math.max(1, Math.ceil(owed / room - 1e-9)) : null; }   // flat: interest = owed x rate x months, so pay x n = owed + owed x r x n
  if (pay <= owed * r + 1e-9) return null;
  return Math.max(1, Math.ceil(-Math.log(1 - (owed * r) / pay) / Math.log(1 + r) - 1e-9));
}
const debtPay = (owed, n, ratePct, flat) => { const r = debtRate(ratePct); return !r ? owed / n : flat ? owed / n + owed * r : (owed * r) / (1 - Math.pow(1 + r, -n)); };
/* the recurring payment of a debt: an active repeating payment made from Record payment (a recurring rule with spec.debt), else the "Monthly payment" typed on the debt.
   Returns { amount (minor units, loan currency), freq } or null. Weekly payments work out the payoff with a weekly rate. */
const debtRule = (l) => (D().recurring || []).find((r) => r.spec && r.spec.debt === l.id && r.active !== false);
function debtPlan(l) {
  const r = debtRule(l);
  if (r) return { amount: r.spec.amount_minor, freq: r.freq };
  return l.monthly_minor > 0 ? { amount: l.monthly_minor, freq: 'monthly' } : null;
}
const debtLeft = (l, plan) => (plan && loanBalance(l) > 0 ? debtN(loanBalance(l), plan.amount, plan.freq === 'weekly' ? ((l.rate || 0) * 12) / 52 : l.rate, l.flat) : null);
const debtOwed = (pay, n, ratePct, flat) => { const r = debtRate(ratePct); return !r ? pay * n : flat ? (pay * n) / (1 + r * n) : (pay * (1 - Math.pow(1 + r, -n))) / r; };
/* the Repeat payment choice shows or hides the payment fields and renames them (Monthly / Weekly); a new debt's accounts follow its currency */
function debtFormChanged(form, name) {
  if (name === 'currency') { const sel = form.account; if (sel) sel.innerHTML = debtAccountOptions(form.currency.value, sel.value); return; }
  const rep = form.repeat.value, wk = rep === 'weekly';
  $('[data-rec]', form).style.display = rep ? 'contents' : 'none';
  $('[data-lbl-pay]', form).textContent = wk ? __('Weekly payment') : __('Monthly payment');
  $('[data-lbl-left]', form).textContent = wk ? __('Installments remaining (Weekly)') : __('Installments remaining (Monthly)');
  if (rep && !form.dataset.nextTouched) form.next.value = nthDate(isoDate(new Date()), rep, 1);
  syncDebtForm(form, null);
}
function syncDebtForm(form, changed) {
  const names = ['amount', 'monthly', 'left'], val = (n) => { const v = parseFloat(form[n].value); return v > 0 ? v : 0; };
  let edited = (form.dataset.edited || '').split(',').filter(Boolean);
  if (changed) {   // 'rate' changes only the working out, not which boxes are the inputs
    edited = edited.filter((n) => n !== changed);
    if (form[changed].value === '') { form.dataset.edited = edited.join(','); return; }
    edited.push(changed); edited = edited.slice(-2); form.dataset.edited = edited.join(',');
  }
  if (edited.length < 2) return;
  const target = names.find((n) => !edited.includes(n)), c = form.currency.value, exp = expOf(c), unit = 10 ** exp, rate = (parseFloat(form.rate.value) || 0) * (form.repeat.value === 'weekly' ? 12 / 52 : 1), flat = form.flat.value === '1';
  const owed = val('amount'), monthly = val('monthly'), left = Math.round(val('left')), up = (x) => String(+(Math.ceil(x * unit - 1e-6) / unit).toFixed(exp));
  if (target === 'left') { const n = debtN(owed, monthly, rate, flat); form.left.value = n === null ? '' : n; }
  else if (target === 'monthly') form.monthly.value = owed > 0 && left > 0 ? up(debtPay(owed, left, rate, flat)) : '';
  else form.amount.value = monthly > 0 && left > 0 ? String(+debtOwed(monthly, left, rate, flat).toFixed(exp)) : '';
}
document.addEventListener('input', (e) => { const t = e.target; if (t.form && t.form.dataset.form === 'loan' && t.name === 'next') t.form.dataset.nextTouched = '1'; if (t.form && t.form.dataset.form === 'loan') { if (['amount', 'monthly', 'left'].includes(t.name)) syncDebtForm(t.form, t.name); else if (t.name === 'rate') syncDebtForm(t.form, null); }
  if (t.form && t.form.dataset.form === 'loan' && t.name === 'flat') { t.form.dataset.flatTouched = '1'; syncDebtForm(t.form, null); }
  // a new vehicle loan or paylater is flat by default (the usual way they are priced); the choice is left alone once you pick one yourself
  if (t.form && t.form.dataset.form === 'loan' && t.name === 'type' && !t.form.dataset.id && !t.form.dataset.flatTouched) { t.form.flat.value = ['car', 'paylater'].includes(t.value) ? '1' : '0'; syncDebtForm(t.form, null); } });
/* archived loans: listed here, Reopen puts one back with all its payments */
/* a payment recorded without an account: look at it, or delete it (the loan goes back up by that amount) */
function loanPaymentDialog(l, pay) {
  const fmt = new Date(pay.date + 'T00:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric' });
  open(`<h2>${__('Debt payment')}</h2><p class="muted" style="margin-top:-10px">${esc(l.name)}</p>
  <div class="hold-sum"><div class="hs-row"><span>${__('Amount')}</span><b class="num">${money(pay.amount_minor, l.currency)}</b></div><div class="hs-row"><span>${__('Date')}</span><b>${esc(fmt)}</b></div><div class="hs-row"><span>${__('Balance now')}</span><b class="num">${money(loanBalance(l), l.currency)}</b></div></div>
  <p class="hint">${__('Deleting removes this payment and the debt balance goes back up by its amount. Use Edit on the debt to set the balance you want afterwards.')}</p>
  <div class="actions"><button type="button" class="btn danger" data-act="delete-payment" data-kind="loan" data-id="${l.id}" data-pid="${pay.id}" data-close="1">${__('Delete payment')}</button></div>`);
}
/* a repayment of money lent: look at it, or delete it (the account loses the money, the amount owed to you goes back up) */
function lentRepaymentDialog(l, pay) {
  const fmt = new Date(pay.date + 'T00:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric' }), t = pay.txn_id && D().transactions.find((x) => x.id === pay.txn_id);
  open(`<h2>${__('Lent repayment')}</h2><p class="muted" style="margin-top:-10px">${esc(l.name)}</p>
  <div class="hold-sum"><div class="hs-row"><span>${__('Amount')}</span><b class="num">${money(pay.amount_minor, l.currency)}</b></div><div class="hs-row"><span>${__('Date')}</span><b>${esc(fmt)}</b></div>${t ? `<div class="hs-row"><span>${__('Received into')}</span><b>${esc(walletOf(t.wallet_id)?.name || '')}</b></div>` : ''}<div class="hs-row"><span>${__('Still owed to you')}</span><b class="num">${money(loanBalance(l), l.currency)}</b></div></div>
  <p class="hint">${__('Deleting removes this repayment and its transfer: the account loses the money and what you are owed goes back up.')}</p>
  <div class="actions"><button type="button" class="btn danger" data-act="delete-payment" data-kind="lent" data-id="${l.id}" data-pid="${pay.id}" data-close="1">${__('Delete repayment')}</button></div>`);
}
function archivedLoansDialog() {
  const list = D().loans.filter((l) => l.archived);
  open(`<h2>${__('Archived debts')}</h2>
  <div class="list up-list">${list.map((l) => `<div class="brow cat-row"><span class="tile" style="--c:#4A44C6">🏦</span><div class="cat-main"><b class="cat-name">${esc(l.name)}</b><small class="muted">${esc(__(LOAN_TYPES[l.type] || l.type))} · ${money(loanBalance(l), l.currency)} ${__('remaining')}</small></div><div class="tools"><button class="btn secondary" data-act="unarchive-loan" data-id="${l.id}">${__('Reopen')}</button></div></div>`).join('') || ('<div class="empty">' + __('No archived debts.') + '</div>')}</div>
  <div class="actions"><button type="button" class="btn" data-act="close">${__('Close')}</button></div>`);
}
const lentAccounts = () => D().wallets.filter((w) => !w.archived && w.type !== 'card');   // savings accounts only: no credit cards, investments are separate
function lentDialog(l) {
  const tx = l && l.txn_id && D().transactions.find((x) => x.id === l.txn_id), older = !!l && !tx;   // an older record has no account and no transaction
  const locked = !!tx && !canEditRec(tx);   // in a household, someone else's lent transaction changes only by its creator or the owner
  let ws = lentAccounts(); if (l && l.payments.length) ws = ws.filter((w) => w.currency === l.currency);   // a lent record with repayments keeps its currency
  const opts = ws.map((w) => `<option value="${w.id}">${esc(w.name)} · ${money(walletBalance(w), w.currency)}</option>`).join('');
  const pick = tx ? tx.wallet_id : recallAcct('lentfrom', opts) || (ws[0] ? ws[0].id : '');
  const dis = older || locked ? 'disabled' : '', curr = tx ? tx.currency : l ? l.currency : (walletOf(pick) || {}).currency || cur();
  const date = tx ? tx.occurred_at : older ? `${l.since}-01` : isoDate(new Date());
  open(`<h2>${l ? __('Edit money lent') : __('Add money lent')}</h2><form data-form="lent" data-id="${l?.id || ''}" style="display:contents">
    <label class="field">${__('Who borrowed it')}<input name="name" required maxlength="40" ${locked ? 'disabled' : ''} value="${esc(l?.name || '')}" placeholder="${__('e.g. Budi')}"></label>
    <label class="field">${__('From account')}<select name="account" ${older ? '' : 'required'} ${dis}>${older ? `<option value="">${__('Not set (older record)')}</option>` : ws.map((w) => `<option value="${w.id}" ${w.id === pick ? 'selected' : ''}>${esc(w.name)} · ${money(walletBalance(w), w.currency)}</option>`).join('')}</select></label>
    <p class="auth-err" id="lent-err" role="alert" hidden></p>
    <div class="two"><label class="field">${__('Amount lent')}<input name="amount" type="number" inputmode="decimal" min="1" step="any" required ${locked ? 'disabled' : ''} value="${l ? toMajor(l.original_minor, l.currency) : ''}"></label>
      <label class="field">${__('Currency')}<select name="currency" disabled>${Object.keys(RATES).map((c) => `<option ${c === curr ? 'selected' : ''} data-list="${flagLabel(c)}">${c}</option>`).join('')}</select></label></div>
    ${older ? '' : `<small class="muted">${__('Currency follows the account.')}</small>`}
    <div class="two"><label class="field">${__('Date lent')}<input name="date" type="date" max="${isoDate(new Date())}" required ${dis} value="${esc(date)}"></label>
      <label class="field">${__('Due date (optional)')}<input name="due" type="date" value="${esc(l?.due || '')}"></label></div>
    <label class="field">${__('Note (optional)')}<input name="note" maxlength="60" value="${esc(l?.note || '')}" placeholder="${__('e.g. Laptop repair')}"></label>
    ${older ? `<p class="hint">${__('This loan was added before accounts were tracked. It has no transaction and you do not need to pick an account.')}</p>` : ''}
    ${locked ? `<p class="hint">${__('The amount, account and date can be changed by the person who added this, or the owner.')}</p>` : ''}
    ${!l && !ws.length ? `<p class="auth-err" role="alert">${__('Add a savings account first: the money you lend comes out of one.')}</p>` : ''}
    <div class="actions">${l ? `<button type="button" class="btn danger" data-act="archive-lent" data-id="${l.id}">${__('Archive')}</button>` : ''}<button class="btn" type="submit" data-send ${!l && !ws.length ? 'disabled' : ''}>${__('Save')}</button></div></form>`);
  const f = $('form[data-form=lent]'); if (f) lentCheck(f);
}
/* the live check of the Add money lent form: the currency follows the account, and the account must hold the amount (the same message as a loan payment) */
function lentCheck(f) {
  const sel = f.elements.account, a = sel && sel.value ? walletOf(sel.value) : null, msg = $('#lent-err', f), btn = $('[data-send]', f);
  if (a && f.elements.currency) f.elements.currency.value = a.currency;
  const existing = f.dataset.id && D().lent.find((x) => x.id === f.dataset.id), tx = existing && existing.txn_id && D().transactions.find((x) => x.id === existing.txn_id);
  let bad = '';
  if (a && !sel.disabled && f.elements.amount && f.elements.date) {
    const amt = toMinor(parseFloat(f.elements.amount.value), a.currency), back = tx && tx.wallet_id === a.id && tx.occurred_at <= todayIso() ? tx.amount_minor : 0, avail = walletBalance(a) + back;
    if (amt > 0 && f.elements.date.value <= todayIso() && amt > avail) bad = __("{name} doesn't have enough balance ({amount} available)", { name: a.name, amount: money(Math.max(0, avail), a.currency) });
  }
  if (msg) { msg.hidden = !bad; msg.textContent = bad; }
  if (btn) btn.disabled = !!bad;
  return bad;
}
document.addEventListener('input', (e) => { const f = e.target.form; if (f && f.dataset.form === 'lent') lentCheck(f); });
document.addEventListener('change', (e) => { const f = e.target.form; if (f && f.dataset.form === 'lent') lentCheck(f); });
/* the transfer out of an account that a lent record made: read-only here, changed from Money lent (PRD rule 2) */
function lentOriginDialog(l, t) {
  const fmt = new Date(t.occurred_at + 'T00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
  open(`<h2>${esc(t.note || l.name)}</h2><div class="hold-sum"><div class="hs-row" style="font-size:22px"><b class="num">−${money(t.amount_minor, t.currency)}</b></div>
    <div class="hs-row"><span>${__('Type')}</span><b>${__('Transfer out')}</b></div><div class="hs-row"><span>${__('Account')}</span><b>${esc(walletOf(t.wallet_id)?.name || '')}</b></div>
    <div class="hs-row"><span>${__('Category')}</span><b>${esc(__(catOf(t.category_id)?.name || 'Lent'))}</b></div><div class="hs-row"><span>${__('Date')}</span><b>${esc(fmt)}</b></div></div>
    <p class="hint">${__('Managed from Money lent. Change or delete it there.')}</p>
    <div class="actions">${canWrite() ? `<button type="button" class="btn" data-act="edit-lent" data-id="${l.id}">${__('Open in Money lent')}</button>` : `<button type="button" class="btn" data-act="close">${__('Close')}</button>`}</div>`);
}
/* every repayment and, for a loan account, every charge (an expense paid with it), newest first */
function loanHistoryDialog(l, kind = 'loan') {
  const lent = kind === 'lent', shown = (m) => money(m, l.currency), rows = [...l.payments].sort((a, b) => b.date.localeCompare(a.date));
  const fmt = (d) => new Date(d + 'T00:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric' });
  open(`<h2>${esc(l.name)}</h2><p class="muted" style="margin-top:-10px">${lent ? __('Repayment history') : __('Payment and charge history')}</p>
  <div class="hold-sum"><div class="hs-row"><span>${lent ? __('Still owed to you') : __('Balance')}</span><b class="num">${shown(loanBalance(l))}</b></div>
    <div class="hs-row"><span>${lent ? __('Lent') : __('Original amount')}</span><b class="num">${shown(l.original_minor)}</b></div>
    ${chargedOf(l) ? `<div class="hs-row"><span>${__('Charged to this account')}</span><b class="num">+${shown(chargedOf(l))}</b></div>` : ''}
    <div class="hs-row"><span>${lent ? __('Repaid') : __('Paid')}</span><b class="num">${shown(paidOf(l))}</b></div></div>
  <div class="list">${rows.map((p) => `<div class="pay-row"><span>${esc(fmt(p.date))}</span><span class="num">${p.kind === 'charge' ? '+' : ''}${shown(p.amount_minor)}</span>${p.kind === 'charge' ? '<span></span>' : `<button class="icon-x" data-act="delete-payment" data-kind="${kind}" data-id="${l.id}" data-pid="${p.id}" aria-label="${__('Remove {what}', { what: lent ? __('repayment') : __('payment') })}">×</button>`}</div>`).join('') || `<p class="muted">${__('No {what}s yet.', { what: lent ? __('repayment') : __('payment') })}</p>`}</div>
  <div class="actions"><button type="button" class="btn" data-act="close">${__('Close')}</button></div>`);
}
function paymentDialog(l, kind = 'loan') {
  const lent = kind === 'lent';
  open(`<h2>${lent ? __('Record repayment') : __('Record payment')}</h2><p class="muted" style="margin-top:-10px">${esc(l.name)} · ${money(loanBalance(l), l.currency)} ${lent ? __('still owed to you') : __('remaining')}</p>
  <form data-form="payment" data-kind="${kind}" data-id="${l.id}" style="display:contents">
    <div class="two"><label class="field">${__('Amount ({cur})', { cur: esc(l.currency) })}<input name="amount" type="number" inputmode="decimal" min="0" step="any" required value="${l.monthly_minor ? toMajor(l.monthly_minor, l.currency) : ''}"></label>
      <label class="field">${__('Date')}<input name="date" type="date" required value="${isoDate(new Date())}"></label></div>
    ${(() => { const ws = D().wallets.filter((w) => !w.archived && w.currency === l.currency), opts = ws.map((w) => `<option value="${w.id}">${esc(w.name)}</option>`).join(''), pick = recallAcct(lent ? 'lentrecv' : 'repay', opts) || (ws[0] ? ws[0].id : '');
      return `<label class="field">${lent ? __('Received into') : __('Paid from')}<select name="account" data-pay-from><option value="">${lent ? __('No account, just record the repayment') : __('No account, just record the payment')}</option>${ws.map((w) => `<option value="${w.id}" ${w.id === pick ? 'selected' : ''}>${esc(w.name)} · ${money(walletBalance(w), w.currency)}</option>`).join('')}</select></label>`; })()}
    ${lent ? '' : repeatField()}
    <p class="hint">${lent ? __('Repayments lower what you are owed. Received into an account, the money is added to it as a transfer (not income).') : __('Payments lower the debt balance and your debt in net worth. Paid from an account, the amount also leaves that account and counts as spending under Debt Payment.') + ' ' + __('A repeating payment is listed under Recurring in Settings and is made automatically on its date.')}</p>
    <div class="actions"><button class="btn" type="submit">${lent ? __('Save repayment') : __('Submit Payment')}</button></div></form>`);
}

