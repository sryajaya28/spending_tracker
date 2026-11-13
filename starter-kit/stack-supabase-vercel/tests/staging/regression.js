/* Real-database regression of the features whose data the fake test database cannot prove: debts (new types, flat interest) and
 * investment sales paid into the account's own cash (profit/loss and fee records without a wallet, tied to holding events).
 * Runs against a REAL hosted copy with the smoke-test account; nothing is mocked.
 *
 *   SMOKE_EMAIL=.. SMOKE_PASSWORD=.. node tests/staging/regression.js <base url> create|cleanup
 *
 * `create` adds the data and checks it after a reload (and prints what it made, so the database can be inspected);
 * `cleanup` removes it again. Run `cleanup` even after a failed `create`. */
const { chromium } = require('playwright');
const [base0, phase] = [process.argv[2], process.argv[3]]; const base = (base0 || '').replace(/\/$/, '');
const email = process.env.SMOKE_EMAIL, password = process.env.SMOKE_PASSWORD;
if (!base || !['create', 'cleanup'].includes(phase) || !email || !password) { console.log('usage: SMOKE_EMAIL=.. SMOKE_PASSWORD=.. node tests/staging/regression.js <base url> create|cleanup'); process.exit(2); }
let bad = 0; const check = (name, cond, extra) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (cond ? '' : '  ' + JSON.stringify(extra))); if (!cond) bad++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 430, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource.*(404|401)/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  const idle = () => p.evaluate(() => Cloud.idle());
  const settle = async () => { await p.waitForTimeout(900); await idle(); await p.waitForTimeout(700); await idle(); await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}); };
  const login = async () => { await p.goto(base + '/', { waitUntil: 'load', timeout: 45000 }); await p.waitForSelector('.land'); await p.click('.land-cta [data-view=signin]'); await p.fill('[name=email]', email); await p.fill('[name=password]', password); await p.click('button[type=submit]'); await p.waitForSelector('.shell', { timeout: 30000 }); await p.waitForTimeout(1500); };
  const reload = async () => { await p.reload({ waitUntil: 'load' }); await p.waitForSelector('.shell', { timeout: 30000 }); await p.waitForTimeout(1800); };
  await login();
  if (phase === 'create') {
    // 1. debts through the form: a Bank Loan (flat interest, installments worked out) and a Paylater
    for (const d of [['SMOKE Bank Loan', 'bank', '12000000', '12', '12'], ['SMOKE Paylater', 'paylater', '3000000', '6', '0']]) {
      await p.evaluate(() => { state.ui.onbSkipped = true; loanDialog(null); }); await p.waitForSelector('#dlg [name=repeat]');
      await p.selectOption('#dlg select[name=repeat]', 'monthly'); await p.selectOption('#dlg select[name=account]', ''); await p.waitForSelector('#dlg [name=left]');
      await p.fill('#dlg [name=name]', d[0]); await p.selectOption('#dlg [name=type]', d[1]); if (d[1] === 'bank') await p.selectOption('#dlg [name=flat]', '1'); await p.fill('#dlg [name=amount]', d[2]); await p.fill('#dlg [name=left]', d[3]); await p.fill('#dlg [name=rate]', d[4]);
      await p.click('#dlg button[type=submit]'); await settle();
    }
    // 2. investment account, cash and an asset; two sales paid into the cash: one at a loss (with a fee), one at a profit
    await p.evaluate(() => {
      D().customAssets['CASH:IDR'] = { symbol: 'IDR', name: 'Cash (IDR)', type: 'cash', cash: 'IDR' };
      const a = { id: uid(), name: 'SMOKE broker', archived: false }; D().investments.push(a);
      const cash = { id: uid(), account_id: a.id, symbol: 'CASH:IDR', quantity: 0, since: '2026-01', trades: [] };
      const btc = { id: uid(), account_id: a.id, symbol: 'BTC', quantity: 1, since: '2026-01', trades: [], open_price: 100000000, ccy: 'IDR' };
      D().holdings.push(cash, btc); window.__smoke = { cash: cash.id, btc: btc.id }; save();
      const today = todayIso();
      recordTrade(btc, { side: 'sell', quantity: 0.4, source: { kind: 'holding', holding: cash }, amount: 30000000, date: today, fee: 25000 });   // cost 40,000,000 -> loss 10,000,000
      recordTrade(btc, { side: 'sell', quantity: 0.2, source: { kind: 'holding', holding: cash }, amount: 30000000, date: today });             // cost 20,000,000 -> profit 10,000,000
      save();
    });
    await settle(); await reload();
    const s = await p.evaluate(() => { const rec = D().transactions.filter((t) => /BTC (loss|profit)|Investment fee/.test(t.note)); const btc = D().holdings.find((h) => h.symbol === 'BTC' && D().investments.find((a) => a.id === h.account_id && a.name === 'SMOKE broker')); const cash = D().holdings.find((h) => h.symbol === 'CASH:IDR' && h.account_id === btc.account_id);
      return { loans: D().loans.filter((l) => /^SMOKE/.test(l.name)).map((l) => ({ n: l.name, type: l.type, flat: l.flat, rate: l.rate, monthly: l.monthly_minor, left: debtN(loanBalance(l), l.monthly_minor, l.rate, l.flat) })), rec: rec.map((t) => ({ note: t.note, type: t.type, wallet: t.wallet_id, minor: t.amount_minor, cat: catOf(t.category_id)?.name, where: txnWhere(t) })), btcQty: btc.quantity, cashQty: cash.quantity, cashAsset: !!D().customAssets['CASH:IDR'], pnl: realizedPnl().filter((e) => e.symbol === 'BTC').map((e) => e.pnl), spent: sumBy(inMonth(currentPeriod()), 'expense'), budgetsHit: budgetStatus(currentPeriod()).length };
    });
    console.log(JSON.stringify(s, null, 1));
    const bank = s.loans.find((l) => l.n === 'SMOKE Bank Loan'), pay = s.loans.find((l) => l.n === 'SMOKE Paylater');
    check('Bank Loan type and flat interest survived the reload', !!bank && bank.type === 'bank' && bank.flat === true && bank.rate === 12, bank);
    check('Paylater type survived; 0% interest means plain division', !!pay && pay.type === 'paylater' && pay.left === 6, pay);
    check('Bank Loan monthly payment is right with flat interest (12,000,000 / 12 + 1% a month = 1,120,000) and 12 installments are left', !!bank && bank.monthly === 1120000 && bank.left === 12, bank);
    const loss = s.rec.find((r) => r.note === 'BTC loss'), gain = s.rec.find((r) => r.note === 'BTC profit'), fee = s.rec.find((r) => /^Investment fee/.test(r.note));
    check('loss record: expense in Investment Loss, no wallet, shown under the investment account', !!loss && loss.type === 'expense' && loss.wallet === null && loss.cat === 'Investment Loss' && loss.minor === 10000000 && loss.where === 'SMOKE broker', loss);
    check('profit record: income in Capital Gain, no wallet', !!gain && gain.type === 'income' && gain.wallet === null && gain.cat === 'Capital Gain' && gain.minor === 10000000, gain);
    check('fee record: expense in Fee, no wallet', !!fee && fee.type === 'expense' && fee.wallet === null && fee.cat === 'Fee' && fee.minor === 25000, fee);
    check('cash got the whole amount received (fee is on top), BTC quantity went down', s.cashQty === 60000000 && Math.abs(s.btcQty - 0.4) < 1e-9, { cash: s.cashQty, btc: s.btcQty });
    check('the cash asset is still recognised after a reload', s.cashAsset === true, s);
    check('realized P&L lists both sales', JSON.stringify(s.pnl.slice().sort((a, c) => a - c).map((x) => Math.round(x))) === JSON.stringify([-10000000, 10000000]), s.pnl);
    check('the loss counts as spending, budgets leave it out', s.spent >= 10025000, s.spent);
    // 3. investment Cash balance as one end of a transfer: deposit with a fee, withdraw with a fee, then edit the deposit
    await p.evaluate(() => {
      const w = { id: uid(), name: 'SMOKE bank', type: 'bank', currency: 'IDR', opening_balance_minor: 100000000, archived: false, since: '2026-01' }; D().wallets.push(w);
      const acc = D().investments.find((a) => a.name === 'SMOKE broker'), cash = D().holdings.find((h) => h.account_id === acc.id && h.symbol === 'CASH:IDR');
      const today = todayIso(); window.__sx = { w: w.id, c: cash.id };
      const dep = saveTransfer({ from: 'w:' + w.id, to: 'h:' + cash.id, amount: 5000000, received: 5000000, fee: 2500, date: today, note: '' });
      const wd = saveTransfer({ from: 'h:' + cash.id, to: 'w:' + w.id, amount: 1000000, received: 1000000, fee: 1500, date: today, note: '' });
      window.__sxErr = dep.error || wd.error || ''; save();
    });
    await settle();
    const gidX = await p.evaluate(() => D().transactions.find((t) => t.type === 'transfer' && t.flow === 'out' && t.transfer_id && t.trade_id && t.wallet_id === window.__sx.w).transfer_id);
    const ed = await p.evaluate((g) => { const r = xferRead(g); const e = saveTransfer({ from: r.from, to: r.to, amount: 6000000, received: 6000000, fee: 3000, date: r.date, note: '', editGid: g }); save(); return e.error || ''; }, gidX);
    await settle(); await reload();
    const cx = await p.evaluate(() => { const w = D().wallets.find((x) => x.name === 'SMOKE bank'), acc = D().investments.find((a) => a.name === 'SMOKE broker'), cash = D().holdings.find((h) => h.account_id === acc.id && h.symbol === 'CASH:IDR');
      const legs = D().transactions.filter((t) => t.transfer_id).map((t) => ({ type: t.type, flow: t.flow || '', wallet: !!t.wallet_id, minor: t.amount_minor, tied: !!t.trade_id, cat: catOf(t.category_id)?.name || null }));
      return { bank: walletBalance(w), cash: cash.quantity, legs, titles: D().transactions.filter((t) => t.transfer_id && t.type === 'transfer').map((t) => transferTitle(t)), sxErr: window.__sxErr || '' }; });
    console.log(JSON.stringify(cx));
    check('deposit and withdrawal with fees saved without error, and the edit too', cx.sxErr === '' && ed === '', { sxErr: cx.sxErr, ed });
    check('after the edit and a reload: the bank paid 6,000,000 + fee 3,000 and received 1,000,000 - the withdrawal', cx.bank === 100000000 - 6000000 - 3000 + 1000000, cx.bank);
    check('after the edit and a reload: the Cash balance has 60,000,000 + 6,000,000 - 1,000,000 - 1,500 fee', cx.cash === 60000000 + 6000000 - 1000000 - 1500, cx.cash);
    check('transfer rows: out leg tied to the Cash event, in leg tied, bank fee in Fee, Cash fee without a wallet', cx.legs.some((l) => l.type === 'transfer' && l.flow === 'out' && l.wallet && l.tied && l.minor === 6000000) && cx.legs.some((l) => l.type === 'transfer' && l.flow === 'in' && l.wallet && l.tied && l.minor === 1000000) && cx.legs.some((l) => l.type === 'expense' && l.wallet && l.minor === 3000 && l.cat === 'Fee') && cx.legs.some((l) => l.type === 'expense' && !l.wallet && l.minor === 1500 && l.cat === 'Fee'), cx.legs);
    await p.evaluate(() => { state.ui.pfTab = 'investment'; location.hash = '#/portfolio/pnl-all'; render(); }); await p.waitForTimeout(700);
    check('Realized P&L page opens with All time', /SMOKE|BTC|Rp/.test(await p.innerText('.main')) && !/\bNaN\b|undefined/.test(await p.innerText('.main')), null);
    // 4. repeating debt payment (Edit debt > Repeat payment): saved in recurring_rules, paid by itself when due, once
    const rules0 = await p.evaluate(() => (D().recurring || []).filter((r) => r.spec && r.spec.debt && D().loans.find((l) => l.id === r.spec.debt && /^SMOKE/.test(l.name))).length);
    check('the two debts made through the form each have a monthly repeating payment after the reload', rules0 === 2, rules0);
    await p.evaluate(() => { state.ui.pfTab = 'loan'; loanDialog(D().loans.find((l) => l.name === 'SMOKE Paylater')); }); await p.waitForSelector('#dlg select[name=repeat]');
    check('the form opens with the saved repeat (Every month)', (await p.inputValue('#dlg select[name=repeat]')) === 'monthly', null);
    await p.selectOption('#dlg select[name=repeat]', 'weekly'); await p.fill('#dlg [name=monthly]', '500000'); await p.selectOption('#dlg select[name=account]', '');
    check('weekly shows "Weekly payment" and "Installments remaining (Weekly)"', /Weekly payment/.test(await p.innerText('#dlg [data-lbl-pay]')) && /Installments remaining \(Weekly\)/.test(await p.innerText('#dlg [data-lbl-left]')), null);
    await p.click('#dlg button[type=submit]'); await settle(); await reload();
    const rr = await p.evaluate(() => { const l = D().loans.find((x) => x.name === 'SMOKE Paylater'), r = (D().recurring || []).find((x) => x.spec && x.spec.debt === l.id); return r ? { freq: r.freq, amount: r.spec.amount_minor, wallet: r.spec.wallet_id, active: r.active, n: (D().recurring || []).filter((x) => x.spec && x.spec.debt === l.id).length } : null; });
    check('the weekly repeating payment (500,000, no account) survived the reload; still one rule for the debt', !!rr && rr.freq === 'weekly' && rr.amount === 500000 && rr.wallet === '' && rr.active !== false && rr.n === 1, rr);
    const before = await p.evaluate(() => { const l = D().loans.find((x) => x.name === 'SMOKE Paylater'), r = D().recurring.find((x) => x.spec && x.spec.debt === l.id), d = new Date(); d.setDate(d.getDate() - 3); r.start = r.next = isoDate(d); return { bal: loanBalance(l), n: l.payments.length }; });
    const made = await p.evaluate(() => runRecurring()); await settle(); await reload();
    const after = await p.evaluate(() => { runRecurring(); const l = D().loans.find((x) => x.name === 'SMOKE Paylater'); return { bal: loanBalance(l), n: l.payments.length }; }); await settle();
    check('the due repeating payment was made once (balance down by 500,000) and survived the reload', made >= 1 && after.n === before.n + 1 && after.bal === before.bal - 500000, { before, after, made });
    await p.evaluate(() => { state.ui.pfTab = 'loan'; location.hash = '#/portfolio'; render(); }); await p.waitForTimeout(500);
    const ptxt = (await p.innerText('.main')).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
    check('the debt card shows the weekly payment and the weeks left, and no percentage', /Rp 500\.000 every week/.test(ptxt) && /weeks? left/.test(ptxt) && !/% paid/.test(ptxt), ptxt.slice(0, 260));
  } else {
    await p.evaluate(() => {
      const sw = D().wallets.find((w) => w.name === 'SMOKE bank');
      if (sw) { [...new Set(D().transactions.filter((t) => t.transfer_id && t.wallet_id === sw.id).map((t) => t.transfer_id))].forEach((g) => removeTransferGroup(g)); D().transactions = D().transactions.filter((t) => t.wallet_id !== sw.id); D().wallets = D().wallets.filter((w) => w.id !== sw.id); }
      const acc = D().investments.find((a) => a.name === 'SMOKE broker');
      if (acc) { const btc = D().holdings.find((h) => h.account_id === acc.id && h.symbol === 'BTC'); if (btc) btc.trades.filter((t) => t.side === 'sell').forEach((t) => removeTrade(btc, t)); D().holdings = D().holdings.filter((h) => h.account_id !== acc.id); D().investments = D().investments.filter((a) => a.id !== acc.id); }
      const smokeLoans = new Set(D().loans.filter((l) => /^SMOKE/.test(l.name)).map((l) => l.id)); D().recurring = (D().recurring || []).filter((r) => !(r.spec && smokeLoans.has(r.spec.debt)));
      D().loans = D().loans.filter((l) => !/^SMOKE/.test(l.name)); save();
    });
    await settle(); await reload();
    const left = await p.evaluate(() => ({ loans: D().loans.filter((l) => /^SMOKE/.test(l.name)).length, acc: D().investments.filter((a) => a.name === 'SMOKE broker').length, rec: D().transactions.filter((t) => /BTC (loss|profit)|Investment fee/.test(t.note)).length, wal: D().wallets.filter((w) => w.name === 'SMOKE bank').length, xfer: D().transactions.filter((t) => t.transfer_id).length, rules: (D().recurring || []).filter((r) => r.spec && r.spec.debt && !D().loans.some((l) => l.id === r.spec.debt)).length }));
    check('everything the regression created is gone after a reload', left.loans === 0 && left.acc === 0 && left.rec === 0 && left.wal === 0 && left.xfer === 0 && left.rules === 0, left);
  }
  check('no script errors', errs.length === 0, errs.slice(0, 3));
  await b.close(); console.log(bad ? `\nREGRESSION ${phase} FAILED (${bad})` : `\nREGRESSION ${phase} PASSED`); process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('FAIL ' + e.message.split('\n')[0]); process.exit(1); });
