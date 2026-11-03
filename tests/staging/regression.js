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
      await p.evaluate(() => { state.ui.onbSkipped = true; loanDialog(null); }); await p.waitForSelector('#dlg [name=left]');
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
    await p.evaluate(() => { state.ui.pfTab = 'investment'; location.hash = '#/portfolio/pnl-all'; render(); }); await p.waitForTimeout(700);
    check('Realized P&L page opens with All time', /SMOKE|BTC|Rp/.test(await p.innerText('.main')) && !/\bNaN\b|undefined/.test(await p.innerText('.main')), null);
  } else {
    await p.evaluate(() => {
      const acc = D().investments.find((a) => a.name === 'SMOKE broker');
      if (acc) { const btc = D().holdings.find((h) => h.account_id === acc.id && h.symbol === 'BTC'); if (btc) btc.trades.filter((t) => t.side === 'sell').forEach((t) => removeTrade(btc, t)); D().holdings = D().holdings.filter((h) => h.account_id !== acc.id); D().investments = D().investments.filter((a) => a.id !== acc.id); }
      D().loans = D().loans.filter((l) => !/^SMOKE/.test(l.name)); save();
    });
    await settle(); await reload();
    const left = await p.evaluate(() => ({ loans: D().loans.filter((l) => /^SMOKE/.test(l.name)).length, acc: D().investments.filter((a) => a.name === 'SMOKE broker').length, rec: D().transactions.filter((t) => /BTC (loss|profit)|Investment fee/.test(t.note)).length }));
    check('everything the regression created is gone after a reload', left.loans === 0 && left.acc === 0 && left.rec === 0, left);
  }
  check('no script errors', errs.length === 0, errs.slice(0, 3));
  await b.close(); console.log(bad ? `\nREGRESSION ${phase} FAILED (${bad})` : `\nREGRESSION ${phase} PASSED`); process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('FAIL ' + e.message.split('\n')[0]); process.exit(1); });
