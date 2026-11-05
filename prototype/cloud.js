'use strict';
/* Supabase layer: sign-in, loading a user's data into the app's in-memory shape, and saving changes.

   The UI keeps working on one in-memory object (state.data). Saving is diff-based: every save() maps
   that object to database rows, compares them with the last known server state, and sends only the
   inserts/updates/deletes. Row-level security guarantees a user only ever sees their own rows. */
const Cloud = (() => {
  const cfg = window.STIVER || {};
  const r12 = (x) => Math.round(x * 1e12) / 1e12;
  const baseSym = (key) => key.replace(/\.(US|JK)$/, '');
  /* where auth links (email confirmation, password reset, Google) should send people back to */
  const appUrl = (host = location.hostname) => (cfg.SITE_URL && /\.vercel\.app$/.test(host) ? cfg.SITE_URL.replace(/\/$/, '') + '/' : location.origin + location.pathname);

  /* ---------- app data  ->  database rows ---------- */
  /* upsert order (parents before children); deletes run in reverse */
  const STAGES = [
    { name: 'categories', stage: 'categories_root', pick: (r) => !r.parent_id },
    { name: 'categories', stage: 'categories_child', pick: (r) => !!r.parent_id },
    { name: 'wallets' }, { name: 'occasions' }, { name: 'investment_accounts' }, { name: 'holdings' }, { name: 'holding_events' },
    { name: 'debts' }, { name: 'transactions' }, { name: 'budgets' }, { name: 'debt_payments' }, { name: 'recurring_rules' },   // debts before transactions (an expense can point at a loan); payments after (a charge points at its expense)
  ];
  const tradeSign = (tr) => (tr.side === 'buy' ? 1 : -1);

  /* catalog: Map(symbol -> [name, type]) for built-in assets, so they need no stored metadata */
  function rowsFromData(d, catalog, userId, ownerId = userId) {   // ownerId: whose household the rows belong to (a member's rows carry the owner's id)
    const R = {
      categories: [], wallets: [], occasions: [], investment_accounts: [], holdings: [], holding_events: [],
      transactions: [], budgets: [], debts: [], debt_payments: [], manual_prices: [], recurring_rules: [],
    };
    d.categories.forEach((c) => R.categories.push({ id: c.id, parent_id: c.parent_id || null, name: c.name, type: c.type, icon: c.icon || null, color: c.color || null, archived: !!c.archived }));
    d.wallets.forEach((w) => R.wallets.push({ id: w.id, name: w.name, type: w.type, currency: w.currency, opening_balance_minor: w.opening_balance_minor, archived: !!w.archived, since_month: `${w.since || '1970-01'}-01` }));
    d.occasions.forEach((o) => R.occasions.push({ id: o.id, name: o.name, amount_minor: o.amount_minor > 0 ? o.amount_minor : null, currency: o.currency, start_date: o.start || null, end_date: o.end || null, archived: !!o.archived }));
    (d.recurring || []).forEach((r) => R.recurring_rules.push({ id: r.id, kind: r.kind, frequency: r.freq, start_date: r.start, next_date: r.next, end_date: r.end || null, active: r.active !== false, spec: r.spec || {} }));
    d.investments.forEach((a) => R.investment_accounts.push({ id: a.id, name: a.name, archived: !!a.archived }));

    const tradeIds = new Set();
    d.holdings.forEach((h) => {
      const cat = catalog.get(h.symbol), meta = d.customAssets[h.symbol] || {};
      R.holdings.push({
        id: h.id, account_id: h.account_id, symbol: h.symbol, provider_symbol: cat ? null : meta.cash ? `cash:${meta.cash}` : meta.yh ? `yh:${meta.yh}|${meta.mult || 1}|${meta.type || 'stock'}` : meta.fh || null,
        name: cat ? cat[0] : meta.name || h.symbol, asset_type: cat ? cat[1] : meta.type === 'commodity' || meta.type === 'cash' ? 'manual' : meta.type || 'manual', archived: false, since_month: `${h.since}-01`, cost_currency: h.ccy || null,
      });
      const opening = r12(h.quantity - h.trades.reduce((a, tr) => a + tradeSign(tr) * tr.quantity, 0));
      if (Math.abs(opening) > 1e-12) {
        h.open_id ||= crypto.randomUUID();
        R.holding_events.push({ id: h.open_id, holding_id: h.id, occurred_at: `${h.since}-01`, quantity_delta: opening, note: 'opening', pair_id: null, unit_price: h.open_price ?? null });
      }
      h.trades.forEach((tr) => {
        tradeIds.add(tr.id);
        R.holding_events.push({ id: tr.id, holding_id: h.id, occurred_at: tr.date, quantity_delta: r12(tradeSign(tr) * tr.quantity), note: tr.kind || null, pair_id: tr.via ? (tr.id < tr.via.pair ? tr.id : tr.via.pair) : null, unit_price: tr.price ?? null });
      });
    });
    d.transactions.forEach((t) => R.transactions.push({
      id: t.id, wallet_id: t.wallet_id, category_id: t.category_id || null, type: t.type, amount_minor: t.amount_minor, currency: t.currency,
      occurred_at: t.occurred_at, note: t.note || null, occasion_id: t.occasion_id && d.occasions.some((o) => o.id === t.occasion_id) ? t.occasion_id : null, category_source: t.category_source || 'user', ai_confidence: t.ai_confidence ?? null,
      debt_id: t.loan_id && d.loans.some((l) => l.id === t.loan_id) ? t.loan_id : null, transfer_direction: t.type === 'transfer' ? t.flow : null, holding_event_id: t.trade_id && tradeIds.has(t.trade_id) ? t.trade_id : null, transfer_group_id: t.transfer_id || null,
    }));
    d.budgets.forEach((b) => R.budgets.push({ id: b.id, category_id: b.category_id || null, amount_minor: b.amount_minor, currency: b.currency, start_month: b.start_month }));
    d.loans.forEach((l) => {
      R.debts.push({ id: l.id, direction: 'owed', name: l.name, type: l.type, currency: l.currency, original_minor: l.original_minor, monthly_minor: l.monthly_minor || 0, interest_rate: l.rate ?? null, interest_flat: !!l.flat, due_date: null, note: null, start_month: `${l.since}-01`, archived: !!l.archived });
      l.payments.forEach((p) => R.debt_payments.push({ id: p.id, debt_id: l.id, paid_on: p.date, amount_minor: p.amount_minor, kind: p.kind === 'charge' ? 'charge' : 'payment', transaction_id: p.txn_id && d.transactions.some((t) => t.id === p.txn_id) ? p.txn_id : null }));   // a charge, or a payment made from an account, points at its expense
    });
    d.lent.forEach((l) => {
      R.debts.push({ id: l.id, direction: 'lent', name: l.name, type: null, currency: l.currency, original_minor: l.original_minor, monthly_minor: 0, interest_rate: null, due_date: l.due || null, note: l.note || null, start_month: `${l.since}-01`, archived: !!l.archived });
      l.payments.forEach((p) => R.debt_payments.push({ id: p.id, debt_id: l.id, paid_on: p.date, amount_minor: p.amount_minor, transaction_id: p.txn_id && d.transactions.some((t) => t.id === p.txn_id) ? p.txn_id : null }));   // a repayment received into an account points at its transfer
    });
    // prices typed in by hand for assets no feed covers (one row per symbol)
    Object.entries(d.customAssets).forEach(([key, m]) => {
      if (m.fh || m.yh || m.cash || !(m.price > 0) || !d.holdings.some((h) => h.symbol === key)) return;
      m.price_date ||= new Date().toISOString().slice(0, 10);
      R.manual_prices.push({ id: key, user_id: ownerId, symbol: key, price_date: m.price_date, price_usd: m.price });
    });
    R.profile = { id: userId, display_name: d.profile.name || null, default_currency: d.profile.currency, ai_tagging_enabled: !!d.profile.ai, sample_ids: d.profile.sample || null, language: d.profile.language || null, period_day: d.profile.period || 1, theme: d.profile.theme || null };
    return R;
  }

  /* ---------- database rows  ->  app data ---------- */
  function dataFromRows(S, catalog) {
    const p = S.profile;
    const d = {
      profile: { name: p.display_name || '', currency: p.default_currency, ai: p.ai_tagging_enabled, sample: p.sample_ids || null, language: p.language || null, theme: p.theme || null, period: p.period_day || 1 },
      categories: [...S.categories].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'expense' ? -1 : 1)).map((c) => ({ id: c.id, parent_id: c.parent_id, name: c.name, type: c.type, icon: c.icon || '•', color: c.color || '#94A3B8', archived: c.archived })),
      wallets: S.wallets.map((w) => ({ id: w.id, name: w.name, type: w.type, currency: w.currency, opening_balance_minor: +w.opening_balance_minor, archived: w.archived, since: w.since_month.slice(0, 7) })),
      occasions: S.occasions.map((o) => ({ id: o.id, name: o.name, amount_minor: o.amount_minor == null ? null : +o.amount_minor, currency: o.currency, start: o.start_date || '', end: o.end_date || '', archived: o.archived })),
      budgets: S.budgets.map((b) => ({ id: b.id, category_id: b.category_id, amount_minor: +b.amount_minor, currency: b.currency, start_month: b.start_month })),
      investments: S.investment_accounts.map((a) => ({ id: a.id, name: a.name, archived: a.archived })),
      recurring: (S.recurring_rules || []).map((r) => ({ id: r.id, kind: r.kind, freq: r.frequency, start: r.start_date, next: r.next_date, end: r.end_date || '', active: r.active, spec: r.spec || {} })),
      customAssets: {}, livePrices: {},
    };
    const txnByEvent = new Map(S.transactions.filter((t) => t.holding_event_id).map((t) => [t.holding_event_id, t]));
    d.transactions = S.transactions.map((t) => {
      const o = { id: t.id, wallet_id: t.wallet_id, category_id: t.category_id, type: t.type, amount_minor: +t.amount_minor, currency: t.currency, occurred_at: t.occurred_at, note: t.note || '', category_source: t.category_source, ai_confidence: t.ai_confidence == null ? null : +t.ai_confidence, created_at: t.created_at ? new Date(t.created_at).toISOString() : '' };
      if (t.transfer_direction) o.flow = t.transfer_direction;
      if (t.holding_event_id) o.trade_id = t.holding_event_id;
      if (t.occasion_id) o.occasion_id = t.occasion_id;
      if (t.debt_id) o.loan_id = t.debt_id;
      if (t.transfer_group_id) o.transfer_id = t.transfer_group_id;
      return o;
    }).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || b.created_at.localeCompare(a.created_at));   // same date: latest entered first

    const events = new Map();
    S.holding_events.forEach((e) => { if (!events.has(e.holding_id)) events.set(e.holding_id, []); events.get(e.holding_id).push(e); });
    const byId = new Map(S.holding_events.map((e) => [e.id, e])), holdingById = new Map(S.holdings.map((h) => [h.id, h]));
    const latestManual = new Map();
    S.manual_prices.forEach((m) => { const cur = latestManual.get(m.symbol); if (!cur || m.price_date > cur.price_date) latestManual.set(m.symbol, m); });
    d.holdings = S.holdings.map((h) => {
      const evs = (events.get(h.id) || []).sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
      const open = evs.find((e) => e.note === 'opening');
      const trades = evs.filter((e) => e.note !== 'opening').map((e) => {
        const delta = +e.quantity_delta, side = delta > 0 ? 'buy' : 'sell', tr = { id: e.id, date: e.occurred_at, side, quantity: Math.abs(delta) };
        if (e.note === 'income' || e.note === 'expense') tr.kind = e.note;
        if (e.unit_price != null) tr.price = +e.unit_price;
        const pair = e.pair_id && S.holding_events.find((x) => x.pair_id === e.pair_id && x.id !== e.id);
        if (pair) {
          const oh = holdingById.get(pair.holding_id);
          tr.via = { holding_id: pair.holding_id, symbol: baseSym(oh ? oh.symbol : '?'), quantity: Math.abs(+pair.quantity_delta), pair: pair.id };
        } else {
          const t = txnByEvent.get(e.id);
          Object.assign(tr, { amount_minor: t ? +t.amount_minor : 0, currency: t ? t.currency : 'USD', wallet_id: t ? t.wallet_id : null });
        }
        return tr;
      });
      const out = { id: h.id, account_id: h.account_id, symbol: h.symbol, quantity: r12(evs.reduce((a, e) => a + +e.quantity_delta, 0)), since: h.since_month.slice(0, 7), trades };
      if (open) { out.open_id = open.id; if (open.unit_price != null) out.open_price = +open.unit_price; }
      if (h.cost_currency) out.ccy = h.cost_currency;
      if (!catalog.has(h.symbol)) {
        const m = latestManual.get(h.symbol);
        d.customAssets[h.symbol] = { symbol: baseSym(h.symbol), name: h.name || h.symbol, type: h.asset_type };
        if (h.provider_symbol && h.provider_symbol.startsWith('cash:')) Object.assign(d.customAssets[h.symbol], { cash: h.provider_symbol.slice(5), symbol: h.provider_symbol.slice(5), type: 'cash' });   // fiat balance in an investment account
        else if (h.provider_symbol && h.provider_symbol.startsWith('yh:')) { const [yh, mult, type] = h.provider_symbol.slice(3).split('|'); Object.assign(d.customAssets[h.symbol], { yh, mult: +mult || 1, type: type || h.asset_type, source: 'yahoo' }); }   // IDX stock or commodity priced from Yahoo
        else if (h.provider_symbol) Object.assign(d.customAssets[h.symbol], { fh: h.provider_symbol, source: 'finnhub' });
        else if (m) Object.assign(d.customAssets[h.symbol], { price: +m.price_usd, price_date: m.price_date });
      }
      return out;
    });
    const debts = (dir) => S.debts.filter((x) => x.direction === dir).map((x) => {
      const o = { id: x.id, name: x.name, currency: x.currency, original_minor: +x.original_minor, since: x.start_month.slice(0, 7), archived: x.archived,
        payments: S.debt_payments.filter((y) => y.debt_id === x.id).sort((a, b) => a.paid_on.localeCompare(b.paid_on)).map((y) => ({ id: y.id, date: y.paid_on, amount_minor: +y.amount_minor, ...(y.kind === 'charge' ? { kind: 'charge' } : {}), ...(y.transaction_id ? { txn_id: y.transaction_id } : {}) })) };
      if (dir === 'owed') Object.assign(o, { type: x.type || 'other', monthly_minor: +x.monthly_minor, rate: x.interest_rate == null ? 0 : +x.interest_rate, flat: !!x.interest_flat });
      else Object.assign(o, { due: x.due_date || '', note: x.note || '' });
      return o;
    });
    d.loans = debts('owed'); d.lent = debts('lent');
    /* who made and last changed each record (labels in a household; not part of what is saved back): by = creator, byAt = creation time, edBy/edAt = last editor and time (only when changed after creation) */
    const meta = (o, r) => { if (r && r.created_by) { o.by = r.created_by; if (r.created_at) o.byAt = new Date(r.created_at).toISOString(); if (r.updated_by && r.updated_at && r.created_at && new Date(r.updated_at) - new Date(r.created_at) > 2000) { o.edBy = r.updated_by; o.edAt = new Date(r.updated_at).toISOString(); } } return o; };
    const attach = (list, rows) => { const m = new Map(rows.map((r) => [r.id, r])); list.forEach((o) => meta(o, m.get(o.id))); };
    attach(d.transactions, S.transactions); attach(d.wallets, S.wallets); attach(d.investments, S.investment_accounts); attach(d.budgets, S.budgets);
    attach(d.loans, S.debts); attach(d.lent, S.debts); attach(d.categories, S.categories); attach(d.occasions, S.occasions);
    return d;
  }

  /* ---------- diff ---------- */
  const keyOf = (name, r) => (name === 'manual_prices' ? `${r.symbol}|${r.price_date}` : r.id);
  function snapshot(R) {
    const s = new Map();
    STAGES.forEach((st) => s.set(st.stage || st.name, new Map(R[st.name].filter(st.pick || (() => true)).map((r) => [keyOf(st.name, r), JSON.stringify(r)]))));
    s.set('manual_prices', new Map(R.manual_prices.map((r) => [keyOf('manual_prices', r), JSON.stringify(r)])));
    s.set('profile', new Map([['p', JSON.stringify(R.profile)]]));
    return s;
  }
  /* what to send: per stage, rows to upsert and keys to delete */
  function diff(R, prev) {
    const next = snapshot(R), ops = { upserts: [], deletes: [], profile: null };
    STAGES.forEach((st) => {
      const key = st.stage || st.name, old = prev.get(key), cur = next.get(key);
      const rows = R[st.name].filter(st.pick || (() => true)).filter((r) => old.get(keyOf(st.name, r)) !== cur.get(keyOf(st.name, r)));
      if (rows.length) ops.upserts.push({ table: st.name, rows, known: new Set(rows.filter((r) => old.has(keyOf(st.name, r))).map((r) => keyOf(st.name, r))) });   // known = already on the server (an edit, not an insert)
      const gone = [...old.keys()].filter((k) => !cur.has(k));
      if (gone.length) ops.deletes.unshift({ table: st.name, ids: gone });
    });
    const mpOld = prev.get('manual_prices'), mpNew = next.get('manual_prices');
    const mp = R.manual_prices.filter((r) => mpOld.get(keyOf('manual_prices', r)) !== mpNew.get(keyOf('manual_prices', r)));
    if (mp.length) ops.upserts.push({ table: 'manual_prices', rows: mp, onConflict: 'user_id,symbol,price_date' });
    const mpGone = [...mpOld.keys()].filter((k) => !mpNew.has(k));
    if (mpGone.length) ops.deletes.unshift({ table: 'manual_prices', ids: mpGone });
    if (prev.get('profile').get('p') !== next.get('profile').get('p')) ops.profile = R.profile;
    return { ops, next };
  }

  /* ---------- runtime ---------- */
  /* household (design 6.3, 7): who this login works for. status: owner | member | invited | former_member. Solo owners keep today's save path exactly. */
  let hh = { status: 'owner', role: 'owner', ownerId: null, people: [], rev: 0, hasMembers: false };
  const revs = new Map();   // 'table|id' -> the revision last seen on the server, sent back with an edit so a stale edit is refused (households only)
  let client = null, userId = null, catalog = new Map(), synced = null, chain = Promise.resolve(), pending = 0, latest = null, onSaveError = () => {};
  const must = (res) => { if (res.error) throw res.error; return res.data; };
  const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

  async function fetchAll(table) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const rows = must(await client.from(table).select('*').order(table === 'manual_prices' ? 'symbol' : 'id', { ascending: true }).range(from, from + 999));
      if (table !== 'manual_prices') rows.forEach((r) => revs.set(`${table}|${r.id}`, r.rev));
      out.push(...rows);
      if (rows.length < 1000) break;
    }
    return out;
  }

  const gone = () => Object.assign(new Error('household_gone'), { code: 'HH_GONE' });
  async function applyProfile(p) {
    const { display_name, default_currency, ai_tagging_enabled, sample_ids, language, theme, period_day } = p;
    // a member changes only their own settings; currency, period day and sample data belong to the household owner
    const row = hh.status === 'member' ? { display_name, ai_tagging_enabled, language, theme } : { display_name, default_currency, ai_tagging_enabled, sample_ids, language, theme, period_day };
    must(await client.from('profiles').update(row).eq('id', userId));
  }
  /* households: new rows are inserted, known rows are updated with the revision last seen (a stale one is refused with HTTP 409, code PT409), and an edit or delete
     of a row someone else already deleted is refused instead of bringing it back (design 7) */
  async function applyStrict(ops) {
    for (const { table, rows, known, onConflict } of ops.upserts) {
      if (table === 'manual_prices') { for (const part of chunk(rows, 400)) must(await client.from(table).upsert(part, { onConflict: onConflict || 'id' })); continue; }
      const fresh = rows.filter((r) => !known.has(r.id)), edits = rows.filter((r) => known.has(r.id));
      for (const part of chunk(fresh, 400)) must(await client.from(table).insert(part).select('id, rev')).forEach((x) => revs.set(`${table}|${x.id}`, x.rev));
      for (const r of edits) {
        const rev = revs.get(`${table}|${r.id}`), out = must(await client.from(table).update(rev == null ? r : { ...r, rev }).eq('id', r.id).select('id, rev'));
        if (!out.length) throw gone();
        revs.set(`${table}|${r.id}`, out[0].rev);
      }
    }
    if (ops.profile) await applyProfile(ops.profile);
    for (const { table, ids } of ops.deletes) {
      for (const id of ids) {
        if (table === 'manual_prices') { const [symbol, price_date] = id.split('|'); must(await client.from(table).delete().eq('symbol', symbol).eq('price_date', price_date)); continue; }
        const rev = revs.get(`${table}|${id}`);
        let q = client.from(table).delete().eq('id', id); if (rev != null) q = q.eq('rev', rev);
        if (!must(await q.select('id')).length) throw gone();
        revs.delete(`${table}|${id}`);
      }
    }
  }

  async function apply(ops) {
    if (hh.hasMembers) return applyStrict(ops);
    for (const { table, rows, onConflict } of ops.upserts) {
      for (const part of chunk(rows, 400)) must(await client.from(table).upsert(part, { onConflict: onConflict || 'id' }));
    }
    if (ops.profile) await applyProfile(ops.profile);
    for (const { table, ids } of ops.deletes) {
      for (const part of chunk(ids, 200)) {
        if (table === 'manual_prices') for (const k of part) { const [symbol, price_date] = k.split('|'); must(await client.from(table).delete().eq('symbol', symbol).eq('price_date', price_date)); }
        else must(await client.from(table).delete().in('id', part));
      }
    }
  }

  return {
    configured: !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase),
    rowsFromData, dataFromRows, diff, snapshot, // exposed for tests
    get userId() { return userId; },
    get pending() { return pending; },

    init(onAuth, catalogMap, errorHandler) {
      catalog = catalogMap; onSaveError = errorHandler;
      client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      // never await a Supabase call inside this callback (it can deadlock); hand off to the app instead
      client.auth.onAuthStateChange((event, session) => { userId = session ? session.user.id : null; setTimeout(() => onAuth(event, session), 0); });
    },

    async load() {
      revs.clear();
      const me = must(await client.from('profiles').select('*').eq('id', userId).single());
      hh = { status: me.household_status || 'owner', role: 'owner', ownerId: userId, people: [], rev: 0, hasMembers: false };
      const noAccess = () => { synced = null; latest = null; return null; };   // the app shows the "no longer have access" page
      if (hh.status === 'invited' || hh.status === 'former_member') return noAccess();
      let profile = me;
      if (hh.status === 'member') {
        const m = must(await client.from('household_members').select('owner_id, role').eq('member_id', userId).maybeSingle());
        if (!m) { hh.status = 'former_member'; return noAccess(); }
        hh.ownerId = m.owner_id; hh.role = m.role; hh.hasMembers = true;
        const hp = must(await client.rpc('household_profile')), h = Array.isArray(hp) ? hp[0] : hp;
        if (h) profile = { ...me, default_currency: h.default_currency, period_day: h.period_day, sample_ids: h.sample_ids };
      }
      const st = must(await client.from('household_state').select('rev, has_members').eq('owner_id', hh.ownerId).maybeSingle());
      if (st) { hh.rev = st.rev; hh.hasMembers = hh.hasMembers || !!st.has_members; }
      if (hh.hasMembers) hh.people = must(await client.rpc('household_people')) || [];
      const [categories, wallets, occasions, transactions, budgets, investment_accounts, holdings, holding_events, debts, debt_payments, manual_prices, recurring_rules] = await Promise.all(
        ['categories', 'wallets', 'occasions', 'transactions', 'budgets', 'investment_accounts', 'holdings', 'holding_events', 'debts', 'debt_payments', 'manual_prices', 'recurring_rules'].map(fetchAll));
      const data = dataFromRows({ profile, categories, wallets, occasions, transactions, budgets, investment_accounts, holdings, holding_events, debts, debt_payments, manual_prices, recurring_rules }, catalog);
      synced = snapshot(rowsFromData(data, catalog, userId, hh.ownerId)); latest = data;
      return data;
    },

    /* household: state, the 30-second poll (one tiny row), member actions and the server functions (design 5, 7) */
    get household() { return hh; },
    canWrite: () => hh.status === 'owner' || (hh.status === 'member' && hh.role === 'editor'),
    async pollChanged() {   // true when someone else changed the household and nothing of ours is waiting to be saved
      if (!userId || !synced || !hh.hasMembers || pending) return false;
      const st = must(await client.from('household_state').select('rev').eq('owner_id', hh.ownerId).maybeSingle());
      return !!st && st.rev !== hh.rev;
    },
    classify(e) {   // the error contract (design 16): guards carry a prefix, plain RLS has none
      const m = String((e && e.message) || '');
      if (e && e.code === 'HH_GONE') return { kind: 'gone' };
      if ((e && (e.code === 'PT409' || e.code === '40001')) || /household_stale/.test(m)) return { kind: 'stale' };
      const g = /household_guard:([a-z_]+)(?::(\d+))?/.exec(m);
      if (g) return { kind: 'guard', what: g[1], n: +g[2] || 0 };
      if (e && e.code === '42501') return { kind: 'rls' };
      return { kind: 'other' };
    },
    async setRole(memberId, role) { must(await client.rpc('set_member_role', { p_member: memberId, p_role: role })); },
    async removeMember(memberId) { must(await client.rpc('remove_member', { p_member: memberId })); },
    async leaveHousehold() { must(await client.rpc('leave_household')); },
    /* invites: every query names its columns (token_hash is not readable by clients) */
    async listInvites() { return must(await client.from('household_invites').select('id, email, role, status, created_at, expires_at').in('status', ['pending']).order('created_at', { ascending: false })); },
    async fn(name, body) {
      const { data, error } = await client.functions.invoke(name, { body });
      if (!error) return data;
      try { return await error.context.json(); } catch (e) { throw error; }
    },
    inviteMember: (email, role) => Cloud.fn('invite-member', { email, role }),
    manageInvite: (action, inviteId) => Cloud.fn('manage-invite', { action, invite_id: inviteId }),
    deleteMyLogin: () => Cloud.fn('delete-my-login', {}),
    /* the join page: no session yet, so a plain call that always carries the token (design 5.2) */
    async joinCall(body, fnName = 'join-household') {
      const r = await fetch(`${cfg.SUPABASE_URL}/functions/v1/${fnName}`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: cfg.SUPABASE_ANON_KEY }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({ error: 'invalid_link' })); return { ...j, _status: r.status };
    },
    joinPreview: (token) => Cloud.joinCall({ action: 'preview', token }),
    async joinHousehold(token, password, displayName) {
      const res = await Cloud.joinCall({ action: 'join', token, password, display_name: displayName });
      if (res.session) must(await client.auth.setSession({ access_token: res.session.access_token, refresh_token: res.session.refresh_token }));
      return res;
    },
    signupGate: (body) => Cloud.joinCall(body, 'signup-gate'),

    /* queue a save; saves run one at a time, each sending only what changed since the last one */
    save(data) {
      if (!userId || !synced) return;
      latest = data; pending++;
      chain = chain.then(async () => {
        try {
          const { ops, next } = diff(rowsFromData(latest, catalog, userId), synced);
          await apply(ops); synced = next;
        } catch (err) { onSaveError(err); }
        finally { pending--; }
      });
    },
    idle: () => chain,

    forget() { synced = null; latest = null; },

    /* auth */
    redirect: () => appUrl(), appUrl,
    getSession: async () => must(await client.auth.getSession()).session,
    /* sign-up goes through the signup-gate function: a fresh address, an existing account and a pending-invite address all get the same answer, so the screen never reveals which (design 5.5) */
    async signUp(email, password, name, currency, captchaToken) {
      const { data, error } = await client.functions.invoke('signup-gate', { body: { email, password, full_name: name, currency, captchaToken } });
      let j = data; if (error) { try { j = await error.context.json(); } catch (e) { return { data: null, error }; } }
      if (j && j.result === 'check_email') return { data: { session: null }, error: null };
      return { data: null, error: { message: j && j.error === 'invalid_input' ? 'Check your email and password (at least 8 characters).' : j && j.error === 'rate_limited' ? 'Too many attempts. Try again in a little while.' : 'Something went wrong. Try again.' } };
    },
    signIn: (email, password, captchaToken) => client.auth.signInWithPassword({ email, password, options: { captchaToken } }),
    google: () => client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: appUrl() } }),
    resend: (email, captchaToken) => client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: appUrl(), captchaToken } }),
    reset: (email, captchaToken) => client.auth.resetPasswordForEmail(email, { redirectTo: appUrl(), captchaToken }),
    setPassword: (password) => client.auth.updateUser({ password }),
    signOut: (scope) => client.auth.signOut({ scope: scope || 'local' }),
    /* bug reports and feedback: screenshots first (private bucket, one folder per user and report), then the row; the database adds the user id and email */
    async submitSupport({ type, message, files, context }) {
      if (!userId) throw new Error('Sign in to send a report');
      const id = crypto.randomUUID(), paths = [], ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
      for (const [i, f] of files.entries()) {
        const path = `${userId}/${id}/${i + 1}.${ext[f.type] || 'jpg'}`;
        must(await client.storage.from('support-attachments').upload(path, f, { contentType: f.type, upsert: false }));
        paths.push(path);
      }
      must(await client.from('support_reports').insert({ id, type, message, attachments: paths, context }));
      return id;
    },
    /* hand this signed-in session to the installed app: a short single-use code (15 minutes), claimed once on the other side */
    async createHandoff() {
      const session = must(await client.auth.getSession()).session; if (!session) return null;
      return must(await client.rpc('create_handoff', { p_refresh_token: session.refresh_token }));
    },
    async claimHandoff(code) {
      const token = must(await client.rpc('claim_handoff', { p_code: code })); if (!token) return false;
      const { error } = await client.auth.refreshSession({ refresh_token: token });
      return !error;
    },
  };
})();
