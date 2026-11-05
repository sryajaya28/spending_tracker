/* in-memory stand-in for supabase-js, used only by the e2e test */
(function () {
  const uuid = () => crypto.randomUUID();
  /*SCHEMA*/ const SCHEMA = {"budgets":["id","user_id","category_id","amount_minor","currency","start_month","created_at","created_by","updated_by","rev"],"categories":["id","user_id","parent_id","name","type","icon","color","archived","created_at","created_by","updated_by","rev"],"debt_payments":["id","user_id","debt_id","paid_on","amount_minor","created_at","kind","transaction_id","created_by","updated_by","rev"],"debts":["id","user_id","direction","name","type","currency","original_minor","monthly_minor","interest_rate","due_date","note","start_month","archived","created_at","interest_flat","created_by","updated_by","rev"],"holding_events":["id","user_id","holding_id","occurred_at","quantity_delta","unit_price_usd","note","created_at","pair_id","unit_price","created_by","updated_by","rev"],"holdings":["id","user_id","account_id","symbol","provider_symbol","name","asset_type","archived","created_at","since_month","cost_currency","created_by","updated_by","rev"],"investment_accounts":["id","user_id","name","archived","created_at","created_by","updated_by","rev"],"manual_prices":["user_id","symbol","price_date","price_usd"],"occasions":["id","user_id","name","amount_minor","currency","start_date","end_date","archived","created_at","created_by","updated_by","rev"],"profiles":["id","display_name","default_currency","timezone","ai_tagging_enabled","created_at","sample_ids","language","theme","period_day","household_status"],"recurring_rules":["id","user_id","kind","frequency","start_date","next_date","end_date","active","spec","created_at","created_by","updated_by","rev"],"support_reports":["id","type","message","attachments","user_id","email","context","status","created_at"],"transactions":["id","user_id","wallet_id","category_id","type","amount_minor","currency","occurred_at","note","category_source","ai_confidence","created_at","updated_at","transfer_direction","holding_event_id","occasion_id","transfer_group_id","debt_id","created_by","updated_by","rev","recurring_rule_id"],"wallets":["id","user_id","name","type","currency","opening_balance_minor","archived","created_at","since_month","created_by","updated_by","rev"]}; /*END SCHEMA*/   // columns of the real tables (production, 2026-11-05); refresh with tools/check_fake_schema.js
  const T = {}; const log = []; window.__log = log; window.__T = T;
  const uid = 'user-0000-0000-0000-000000000001';
  let session = null, cb = null;
  const keyOf = (t, r) => (t === 'manual_prices' ? r.symbol + '|' + r.price_date : r.id);
  window.__seedNewUser = () => {
    const P = (name, type, icon, color, parent) => ({ id: uuid(), parent_id: parent || null, name, type, icon, color, archived: false });
    const roots = [['Groceries','expense','🛒','#4A44C6'],['Dining','expense','🍽️','#8B8FF0'],['Transport','expense','🚌','#F5B800'],['Shopping','expense','🛍️','#EC4899'],['Bills & Utilities','expense','🧾','#14B8A6'],['Entertainment','expense','🎬','#F97316'],['Health','expense','🩺','#EF4444'],['Travel','expense','✈️','#0EA5E9'],['Other','expense','⋯','#94A3B8'],['Salary','income','💼','#22C55E'],['Freelance','income','💻','#84CC16'],['Other income','income','➕','#94A3B8']].map((x) => P(...x));
    const by = (n) => roots.find((r) => r.name === n);
    const sub = (par, n, ic) => P(n, 'expense', ic, par.color, par.id);
    T.categories = [...roots, sub(by('Groceries'), 'Supermarket', '🏬'), sub(by('Groceries'), 'Fresh market', '🥬'), sub(by('Dining'), 'Coffee', '☕'), sub(by('Dining'), 'Restaurants', '🍴'), sub(by('Dining'), 'Delivery', '🛵'), sub(by('Transport'), 'Fuel', '⛽'), sub(by('Transport'), 'Ride-hailing', '🚕'), sub(by('Transport'), 'Public transit', '🚇'), sub(by('Entertainment'), 'Movies', '🎬'), sub(by('Entertainment'), 'Streaming', '📺'), sub(by('Entertainment'), 'Events', '🎟️')];
    T.wallets = [{ id: uuid(), name: 'Cash', type: 'cash', currency: 'IDR', opening_balance_minor: 0, archived: false, since_month: new Date().toISOString().slice(0, 7) + '-01' }];
    T.profiles = [{ id: uid, display_name: 'Test User', default_currency: 'IDR', ai_tagging_enabled: true }];
    ['transactions','occasions','budgets','investment_accounts','holdings','holding_events','debts','debt_payments','manual_prices','recurring_rules'].forEach((t) => (T[t] = []));
  };
  window.__seedNewUser();
  class Q {
    constructor(t) { this.t = t; this.op = 'select'; this.f = []; }
    select() { return this; } order() { return this; } range(a, b) { this.r = [a, b]; return this; } single() { this.one = true; return this; } maybeSingle() { this.one = true; return this; }
    eq(k, v) { this.f.push((r) => r[k] === v); this.fl = (this.fl || []).concat([[k, v]]); return this; }
    in(k, vs) { this.f.push((r) => vs.includes(r[k])); this.fl = (this.fl || []).concat([[k, vs]]); return this; }
    upsert(rows, o) { this.op = 'upsert'; this.rows = rows; this.o = o || {}; return this; }
    insert(row) { this.op = 'insert'; this.row = row; return this; }
    update(v) { this.op = 'update'; this.v = v; return this; }
    delete() { this.op = 'delete'; return this; }
    then(res, rej) { return Promise.resolve().then(() => this.run()).then(res, rej); }
    run() {
      const t = this.t, rows = T[t] || (T[t] = []);
      if (window.__failNext && this.op !== 'select') { window.__failNext = false; return { data: null, error: { message: 'simulated failure' } }; }
      if (this.op === 'select') {
        let out = rows.filter((r) => this.f.every((f) => f(r)));
        if (this.r) out = out.slice(this.r[0], this.r[1] + 1);
        out = JSON.parse(JSON.stringify(out));
        return { data: this.one ? out[0] : out, error: null };
      }
      if (this.op !== 'select' && SCHEMA[t]) {   // strict like the real table: an unknown column is refused (PGRST204), as 'manual_prices.id' would have been
        const sent = this.op === 'upsert' ? this.rows : this.op === 'insert' ? [this.row] : [this.v];
        for (const r of sent) for (const k of Object.keys(r || {})) if (!SCHEMA[t].includes(k)) return { data: null, error: { code: 'PGRST204', message: "Could not find the '" + k + "' column of '" + t + "' in the schema cache" } };
      }
      if (this.op === 'upsert' && t === 'manual_prices' && this.rows.some((r) => 'id' in r)) return { data: null, error: { message: "Could not find the 'id' column of 'manual_prices' in the schema cache" } };   // the real table has no id column
      if (this.op === 'upsert') {
        log.push({ op: 'upsert', table: t, rows: JSON.parse(JSON.stringify(this.rows)), onConflict: this.o.onConflict });
        this.rows.forEach((n) => { const i = rows.findIndex((r) => keyOf(t, r) === keyOf(t, n)); if (i >= 0) Object.assign(rows[i], n); else rows.push({ created_at: new Date().toISOString(), ...JSON.parse(JSON.stringify(n)) }); });   // like the database default (created_at = now() on insert, kept on update)
        return { data: null, error: null };
      }
      if (this.op === 'insert') {   // the database fills in the sender, like the real trigger
        const row = { ...JSON.parse(JSON.stringify(this.row)), user_id: uid, email: (session && session.user.email) || null, status: 'new', created_at: new Date().toISOString() }; log.push({ op: 'insert', table: t, row }); rows.push(row); return { data: null, error: null };
      }
      if (this.op === 'update') {
        log.push({ op: 'update', table: t, values: this.v, where: this.fl });
        rows.filter((r) => this.f.every((f) => f(r))).forEach((r) => Object.assign(r, this.v));
        return { data: null, error: null };
      }
      log.push({ op: 'delete', table: t, where: this.fl });
      T[t] = rows.filter((r) => !this.f.every((f) => f(r)));
      return { data: null, error: null };
    }
  }
  const mkSession = (email) => ({ user: { id: uid, email }, access_token: 'x' });
  // session handoff (browser -> installed app): codes live in localStorage so a second page of the same browser context can claim one
  const handoffs = () => JSON.parse(localStorage.getItem('__handoffs') || '{}');
  const rpc = async (fn, args) => {
    const h = handoffs();
    if (fn === 'create_handoff') { if (!session) return { data: null, error: { message: 'not signed in' } }; const code = 'AB' + String(Object.keys(h).length + 1).padStart(2, '0') + 'XYZK' + 'K2'; h[code] = args.p_refresh_token || 'rt'; localStorage.setItem('__handoffs', JSON.stringify(h)); return { data: code, error: null }; }
    if (fn === 'claim_handoff') { const code = String(args.p_code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); const t = h[code] || null; delete h[code]; localStorage.setItem('__handoffs', JSON.stringify(h)); return { data: t, error: null }; }
    if (fn === 'household_people') return { data: window.__hhPeople || [], error: null };
    if (fn === 'household_profile') return { data: [{ default_currency: 'IDR', period_day: 1, sample_ids: null }], error: null };
    if (['set_member_role', 'remove_member', 'leave_household'].includes(fn)) { (window.__hhCalls = window.__hhCalls || []).push([fn, args]); return { data: null, error: null }; }
    return { data: null, error: { message: 'unknown rpc' } };
  };
  window.supabase = { createClient: () => ({
    from: (t) => new Q(t),
    storage: { from: (bucket) => ({ upload: async (path, file, o) => { if (window.__failUpload) return { data: null, error: { message: 'upload failed' } }; (window.__uploads = window.__uploads || []).push({ bucket, path, size: file.size, type: o && o.contentType }); return { data: { path }, error: null }; } }) },
    rpc,
    functions: { invoke: async (name, o) => {   // only the sign-up gate is faked here (the household tests replace Cloud.fn themselves)
      const b = (o && o.body) || {};
      if (name === 'signup-gate') { window.__signUp = { email: b.email, password: b.password, options: { data: { full_name: b.full_name, currency: b.currency }, captchaToken: b.captchaToken } }; window.__signUpOpts = window.__signUp.options; return { data: { result: window.__gateReply || 'check_email' }, error: null }; }
      return { data: null, error: { message: 'unknown function' } };
    } },
    auth: {
      onAuthStateChange: (f) => { cb = f; setTimeout(() => f('INITIAL_SESSION', session), 0); return { data: { subscription: {} } }; },
      signInWithPassword: async ({ email, password, options }) => {
        window.__signInOpts = options; window.__signInCalls = (window.__signInCalls || 0) + 1;
        if (window.__unconfirmed) return { error: { message: 'Email not confirmed' } };
        if (password === 'bad') return { error: { message: 'Invalid login credentials' } };
        session = mkSession(email); setTimeout(() => cb('SIGNED_IN', session), 0); return { data: { session }, error: null };
      },
      signUp: async (a) => { window.__signUp = a; window.__signUpOpts = a.options; return { data: { session: null, user: { id: uid } }, error: null }; },
      signInWithOAuth: async (a) => { window.__oauth = a; return { error: null }; },
      resend: async (a) => { window.__resend = a; return { error: null }; },
      resetPasswordForEmail: async (e, o) => { window.__reset = [e, o]; return { error: null }; },
      updateUser: async (a) => { window.__upd = a; return { error: null }; },
      setSession: async (t) => { window.__setSession = t; session = mkSession(window.__joinEmail || 'invitee@test.dev'); setTimeout(() => cb('SIGNED_IN', session), 0); return { data: { session }, error: null }; },
      signOut: async (o) => { window.__signOut = o; if (!o || o.scope !== 'others') { session = null; setTimeout(() => cb('SIGNED_OUT', null), 0); } return { error: null }; },
      getSession: async () => ({ data: { session: session && { ...session, refresh_token: 'rt-1' } }, error: null }),
      refreshSession: async ({ refresh_token }) => { if (!refresh_token) return { error: { message: 'no token' } }; session = mkSession('a@b.co'); setTimeout(() => cb('SIGNED_IN', session), 0); return { data: { session }, error: null }; },
    },
  }) };
})();
