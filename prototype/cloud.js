'use strict';
/* Supabase layer: sign-in, loading a user's data into the app's in-memory shape, and saving changes.

   The UI keeps working on one in-memory object (state.data). Saving is diff-based: every save() maps
   that object to database rows, compares them with the last known server state, and sends only the
   inserts/updates/deletes. Row-level security guarantees a user only ever sees their own rows. */
const Cloud = (() => {
  const cfg = window.STIVER || {};
  const r12 = (x) => Math.round(x * 1e12) / 1e12;
  const baseSym = (key) => key.replace(/\.US$/, '');
  /* where auth links (email confirmation, password reset, Google) should send people back to */
  const appUrl = (host = location.hostname) => (cfg.SITE_URL && /\.vercel\.app$/.test(host) ? cfg.SITE_URL.replace(/\/$/, '') + '/' : location.origin + location.pathname);

  /* ---------- app data  ->  database rows ---------- */
  /* upsert order (parents before children); deletes run in reverse */
  const STAGES = [
    { name: 'categories', stage: 'categories_root', pick: (r) => !r.parent_id },
    { name: 'categories', stage: 'categories_child', pick: (r) => !!r.parent_id },
    { name: 'wallets' }, { name: 'occasions' }, { name: 'investment_accounts' }, { name: 'holdings' }, { name: 'holding_events' },
    { name: 'transactions' }, { name: 'budgets' }, { name: 'debts' }, { name: 'debt_payments' }, { name: 'recurring_rules' },
  ];
  const tradeSign = (tr) => (tr.side === 'buy' ? 1 : -1);

  /* catalog: Map(symbol -> [name, type]) for built-in assets, so they need no stored metadata */
  function rowsFromData(d, catalog, userId) {
    const R = {
      categories: [], wallets: [], occasions: [], investment_accounts: [], holdings: [], holding_events: [],
      transactions: [], budgets: [], debts: [], debt_payments: [], manual_prices: [], recurring_rules: [],
    };
    d.categories.forEach((c) => R.categories.push({ id: c.id, parent_id: c.parent_id || null, name: c.name, type: c.type, icon: c.icon || null, color: c.color || null, archived: !!c.archived }));
    d.wallets.forEach((w) => R.wallets.push({ id: w.id, name: w.name, type: w.type, currency: w.currency, opening_balance_minor: w.opening_balance_minor, archived: !!w.archived, since_month: `${w.since || '1970-01'}-01` }));
    d.occasions.forEach((o) => R.occasions.push({ id: o.id, name: o.name, amount_minor: o.amount_minor, currency: o.currency, start_date: o.start || null, end_date: o.end || null, archived: !!o.archived }));
    (d.recurring || []).forEach((r) => R.recurring_rules.push({ id: r.id, kind: r.kind, frequency: r.freq, start_date: r.start, next_date: r.next, end_date: r.end || null, active: r.active !== false, spec: r.spec || {} }));
    d.investments.forEach((a) => R.investment_accounts.push({ id: a.id, name: a.name, archived: !!a.archived }));

    const tradeIds = new Set();
    d.holdings.forEach((h) => {
      const cat = catalog.get(h.symbol), meta = d.customAssets[h.symbol] || {};
      R.holdings.push({
        id: h.id, account_id: h.account_id, symbol: h.symbol, provider_symbol: cat ? null : meta.fh || null,
        name: cat ? cat[0] : meta.name || h.symbol, asset_type: cat ? cat[1] : meta.type || 'manual', archived: false, since_month: `${h.since}-01`,
      });
      const opening = r12(h.quantity - h.trades.reduce((a, tr) => a + tradeSign(tr) * tr.quantity, 0));
      if (Math.abs(opening) > 1e-12) {
        h.open_id ||= crypto.randomUUID();
        R.holding_events.push({ id: h.open_id, holding_id: h.id, occurred_at: `${h.since}-01`, quantity_delta: opening, note: 'opening', pair_id: null });
      }
      h.trades.forEach((tr) => {
        tradeIds.add(tr.id);
        R.holding_events.push({ id: tr.id, holding_id: h.id, occurred_at: tr.date, quantity_delta: r12(tradeSign(tr) * tr.quantity), note: tr.kind || null, pair_id: tr.via ? (tr.id < tr.via.pair ? tr.id : tr.via.pair) : null });
      });
    });
    d.transactions.forEach((t) => R.transactions.push({
      id: t.id, wallet_id: t.wallet_id, category_id: t.category_id || null, type: t.type, amount_minor: t.amount_minor, currency: t.currency,
      occurred_at: t.occurred_at, note: t.note || null, occasion_id: t.occasion_id && d.occasions.some((o) => o.id === t.occasion_id) ? t.occasion_id : null, category_source: t.category_source || 'user', ai_confidence: t.ai_confidence ?? null,
      transfer_direction: t.type === 'transfer' ? t.flow : null, holding_event_id: t.trade_id && tradeIds.has(t.trade_id) ? t.trade_id : null, transfer_group_id: t.transfer_id || null,
    }));
    d.budgets.forEach((b) => R.budgets.push({ id: b.id, category_id: b.category_id || null, amount_minor: b.amount_minor, currency: b.currency, start_month: b.start_month }));
    d.loans.forEach((l) => {
      R.debts.push({ id: l.id, direction: 'owed', name: l.name, type: l.type, currency: l.currency, original_minor: l.original_minor, monthly_minor: l.monthly_minor || 0, interest_rate: l.rate ?? null, due_date: null, note: null, start_month: `${l.since}-01`, archived: !!l.archived });
      l.payments.forEach((p) => R.debt_payments.push({ id: p.id, debt_id: l.id, paid_on: p.date, amount_minor: p.amount_minor }));
    });
    d.lent.forEach((l) => {
      R.debts.push({ id: l.id, direction: 'lent', name: l.name, type: null, currency: l.currency, original_minor: l.original_minor, monthly_minor: 0, interest_rate: null, due_date: l.due || null, note: l.note || null, start_month: `${l.since}-01`, archived: !!l.archived });
      l.payments.forEach((p) => R.debt_payments.push({ id: p.id, debt_id: l.id, paid_on: p.date, amount_minor: p.amount_minor }));
    });
    // prices typed in by hand for assets no feed covers (one row per symbol)
    Object.entries(d.customAssets).forEach(([key, m]) => {
      if (m.fh || !(m.price > 0) || !d.holdings.some((h) => h.symbol === key)) return;
      m.price_date ||= new Date().toISOString().slice(0, 10);
      R.manual_prices.push({ id: key, user_id: userId, symbol: key, price_date: m.price_date, price_usd: m.price });
    });
    R.profile = { id: userId, display_name: d.profile.name || null, default_currency: d.profile.currency, ai_tagging_enabled: !!d.profile.ai, sample_ids: d.profile.sample || null, language: d.profile.language || null, theme: d.profile.theme || null };
    return R;
  }

  /* ---------- database rows  ->  app data ---------- */
  function dataFromRows(S, catalog) {
    const p = S.profile;
    const d = {
      profile: { name: p.display_name || '', currency: p.default_currency, ai: p.ai_tagging_enabled, sample: p.sample_ids || null, language: p.language || null, theme: p.theme || null },
      categories: [...S.categories].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'expense' ? -1 : 1)).map((c) => ({ id: c.id, parent_id: c.parent_id, name: c.name, type: c.type, icon: c.icon || '•', color: c.color || '#94A3B8', archived: c.archived })),
      wallets: S.wallets.map((w) => ({ id: w.id, name: w.name, type: w.type, currency: w.currency, opening_balance_minor: +w.opening_balance_minor, archived: w.archived, since: w.since_month.slice(0, 7) })),
      occasions: S.occasions.map((o) => ({ id: o.id, name: o.name, amount_minor: +o.amount_minor, currency: o.currency, start: o.start_date || '', end: o.end_date || '', archived: o.archived })),
      budgets: S.budgets.map((b) => ({ id: b.id, category_id: b.category_id, amount_minor: +b.amount_minor, currency: b.currency, start_month: b.start_month })),
      investments: S.investment_accounts.map((a) => ({ id: a.id, name: a.name, archived: a.archived })),
      recurring: (S.recurring_rules || []).map((r) => ({ id: r.id, kind: r.kind, freq: r.frequency, start: r.start_date, next: r.next_date, end: r.end_date || '', active: r.active, spec: r.spec || {} })),
      customAssets: {}, livePrices: {},
    };
    const txnByEvent = new Map(S.transactions.filter((t) => t.holding_event_id).map((t) => [t.holding_event_id, t]));
    d.transactions = S.transactions.map((t) => {
      const o = { id: t.id, wallet_id: t.wallet_id, category_id: t.category_id, type: t.type, amount_minor: +t.amount_minor, currency: t.currency, occurred_at: t.occurred_at, note: t.note || '', category_source: t.category_source, ai_confidence: t.ai_confidence == null ? null : +t.ai_confidence };
      if (t.transfer_direction) o.flow = t.transfer_direction;
      if (t.holding_event_id) o.trade_id = t.holding_event_id;
      if (t.occasion_id) o.occasion_id = t.occasion_id;
      if (t.transfer_group_id) o.transfer_id = t.transfer_group_id;
      return o;
    }).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

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
      if (open) out.open_id = open.id;
      if (!catalog.has(h.symbol)) {
        const m = latestManual.get(h.symbol);
        d.customAssets[h.symbol] = { symbol: baseSym(h.symbol), name: h.name || h.symbol, type: h.asset_type };
        if (h.provider_symbol) Object.assign(d.customAssets[h.symbol], { fh: h.provider_symbol, source: 'finnhub' });
        else if (m) Object.assign(d.customAssets[h.symbol], { price: +m.price_usd, price_date: m.price_date });
      }
      return out;
    });
    const debts = (dir) => S.debts.filter((x) => x.direction === dir).map((x) => {
      const o = { id: x.id, name: x.name, currency: x.currency, original_minor: +x.original_minor, since: x.start_month.slice(0, 7), archived: x.archived,
        payments: S.debt_payments.filter((y) => y.debt_id === x.id).sort((a, b) => a.paid_on.localeCompare(b.paid_on)).map((y) => ({ id: y.id, date: y.paid_on, amount_minor: +y.amount_minor })) };
      if (dir === 'owed') Object.assign(o, { type: x.type || 'other', monthly_minor: +x.monthly_minor, rate: x.interest_rate == null ? 0 : +x.interest_rate });
      else Object.assign(o, { due: x.due_date || '', note: x.note || '' });
      return o;
    });
    d.loans = debts('owed'); d.lent = debts('lent');
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
      if (rows.length) ops.upserts.push({ table: st.name, rows });
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
  let client = null, userId = null, catalog = new Map(), synced = null, chain = Promise.resolve(), pending = 0, latest = null, onSaveError = () => {};
  const must = (res) => { if (res.error) throw res.error; return res.data; };
  const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

  async function fetchAll(table) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const rows = must(await client.from(table).select('*').order(table === 'manual_prices' ? 'symbol' : 'id', { ascending: true }).range(from, from + 999));
      out.push(...rows);
      if (rows.length < 1000) break;
    }
    return out;
  }

  async function apply(ops) {
    for (const { table, rows, onConflict } of ops.upserts) {
      for (const part of chunk(rows, 400)) must(await client.from(table).upsert(part, { onConflict: onConflict || 'id' }));
    }
    if (ops.profile) {
      const { display_name, default_currency, ai_tagging_enabled, sample_ids, language, theme } = ops.profile;
      must(await client.from('profiles').update({ display_name, default_currency, ai_tagging_enabled, sample_ids, language, theme }).eq('id', userId));
    }
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
      const [profile, categories, wallets, occasions, transactions, budgets, investment_accounts, holdings, holding_events, debts, debt_payments, manual_prices, recurring_rules] = await Promise.all([
        client.from('profiles').select('*').eq('id', userId).single().then(must),
        ...['categories', 'wallets', 'occasions', 'transactions', 'budgets', 'investment_accounts', 'holdings', 'holding_events', 'debts', 'debt_payments', 'manual_prices', 'recurring_rules'].map(fetchAll),
      ]);
      const data = dataFromRows({ profile, categories, wallets, occasions, transactions, budgets, investment_accounts, holdings, holding_events, debts, debt_payments, manual_prices, recurring_rules }, catalog);
      synced = snapshot(rowsFromData(data, catalog, userId)); latest = data;
      return data;
    },

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
    signUp: (email, password, name, currency, captchaToken) => client.auth.signUp({ email, password, options: { data: { full_name: name, currency }, emailRedirectTo: appUrl(), captchaToken } }),
    signIn: (email, password, captchaToken) => client.auth.signInWithPassword({ email, password, options: { captchaToken } }),
    google: () => client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: appUrl() } }),
    resend: (email, captchaToken) => client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: appUrl(), captchaToken } }),
    reset: (email, captchaToken) => client.auth.resetPasswordForEmail(email, { redirectTo: appUrl(), captchaToken }),
    setPassword: (password) => client.auth.updateUser({ password }),
    signOut: (scope) => client.auth.signOut({ scope: scope || 'local' }),
  };
})();
