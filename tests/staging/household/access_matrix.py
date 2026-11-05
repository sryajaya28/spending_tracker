import os, sys, json, uuid, datetime
from sb import *
R = []; created = {}
def ck(ok, name, detail=''):
    R.append(('PASS ' if ok else 'FAIL ') + name + (('  ' + str(detail)[:230]) if detail != '' else ''))
    if not ok:
        print('\n'.join(R)); print('STOPPED AT FIRST FAILURE'); finish(); sys.exit(1)
def finish():
    json.dump(created, open('created.json', 'w'))
otok, ouid = login('smoke.staging@stiver.io', os.environ['SMOKE_STAGING_PASSWORD'])
mtok, muid = login('suryajaya378+hh3@gmail.com', open('pw_hh3.txt').read().strip())
def u(): return str(uuid.uuid4())
RUN = u()[:5]
def ins(tok, table, row):
    s, j = rest('POST', table, tok, row); return s, j
def rows(j): return j if isinstance(j, list) else []
today = datetime.date.today().isoformat()
def payloads(wallet_id, tag):
    tag0 = tag; tag = tag + RUN
    ids = {k: u() for k in ['wallet', 'cat', 'occ', 'bud', 'debt', 'dp', 'acc', 'hold', 'he', 'rule', 'mp', 'tx']}
    p = [
        ('wallets', {'id': ids['wallet'], 'user_id': ouid, 'name': 'QA-HH wallet ' + tag}),
        ('categories', {'id': ids['cat'], 'user_id': ouid, 'name': 'QA-HH cat ' + tag}),
        ('occasions', {'id': ids['occ'], 'user_id': ouid, 'name': 'QA-HH occ ' + tag}),
        ('budgets', {'id': ids['bud'], 'user_id': ouid, 'amount_minor': 1000, 'start_month': '20%02d-%02d-01' % (40 + int(RUN, 16) % 55, 1 + (int(RUN, 16) + len(tag0) + ord(tag0[0])) % 12)}),
        ('debts', {'id': ids['debt'], 'user_id': ouid, 'direction': 'owed', 'name': 'QA-HH debt ' + tag, 'original_minor': 1000}),
        ('debt_payments', {'id': ids['dp'], 'user_id': ouid, 'debt_id': ids['debt'], 'amount_minor': 100}),
        ('investment_accounts', {'id': ids['acc'], 'user_id': ouid, 'name': 'QA-HH acc ' + tag}),
        ('holdings', {'id': ids['hold'], 'user_id': ouid, 'account_id': ids['acc'], 'symbol': 'QAHH' + tag0.upper() + RUN.upper(), 'asset_type': 'manual'}),
        ('holding_events', {'id': ids['he'], 'user_id': ouid, 'holding_id': ids['hold'], 'quantity_delta': 1}),
        ('recurring_rules', {'id': ids['rule'], 'user_id': ouid, 'kind': 'txn', 'frequency': 'monthly', 'start_date': today, 'next_date': today, 'spec': {'wallet_id': wallet_id, 'type': 'expense', 'amount_minor': 100}}),
        ('manual_prices', {'user_id': ouid, 'symbol': 'QAHH' + tag0.upper() + RUN.upper(), 'price_usd': 1}),
        ('transactions', {'id': ids['tx'], 'user_id': ouid, 'wallet_id': wallet_id, 'type': 'expense', 'amount_minor': 1000, 'note': 'QA-HH ' + tag}),
    ]
    return ids, p
# owner test wallet and an owner transaction + category used by it
Wo, Co, To = u(), u(), u()
s, j = ins(otok, 'wallets', {'id': Wo, 'user_id': ouid, 'name': 'QA-HH owner wallet ' + RUN}); ck(s == 201, 'setup owner wallet', s)
s, j = ins(otok, 'categories', {'id': Co, 'user_id': ouid, 'name': 'QA-HH owner cat ' + RUN}); ck(s == 201, 'setup owner category', s)
s, j = ins(otok, 'transactions', {'id': To, 'user_id': ouid, 'wallet_id': Wo, 'category_id': Co, 'type': 'expense', 'amount_minor': 5000, 'note': 'QA-HH owner tx'}); ck(s == 201, 'setup owner transaction', s)
created.update({'Wo': Wo, 'Co': Co, 'To': To})
ck(rows(j)[0].get('created_by') == ouid, 'HH-23 owner row created_by = owner (trigger, not the client)')

# ---- Phase 1: the Editor can add on every table (HH-18); created_by is the Editor (HH-22/23)
ids_e, pl = payloads(Wo, 'e1'); created['editor_ids'] = ids_e
for t, row in pl:
    s, j = ins(mtok, t, row)
    ck(s == 201, 'HH-18 Editor inserts into ' + t, s if s == 201 else (s, j))
    if t in ('transactions', 'wallets'): ck(rows(j)[0].get('created_by') == muid, 'HH-23 ' + t + ' created_by = the Editor', rows(j)[0].get('created_by'))
# spoof: Editor tries to insert a row claiming created_by = owner
s, j = ins(mtok, 'transactions', {'id': u(), 'user_id': ouid, 'wallet_id': Wo, 'type': 'expense', 'amount_minor': 1, 'note': 'QA-HH spoof', 'created_by': ouid})
if s == 201: created.setdefault('extra_tx', []).append(rows(j)[0]['id'])
ck(s != 201 or rows(j)[0].get('created_by') == muid, 'HH-39 Editor cannot spoof created_by on insert', 'status %s created_by %s' % (s, rows(j)[0].get('created_by') if s == 201 else '-'))
# insert for another household's owner id is refused
s, j = ins(mtok, 'wallets', {'id': u(), 'user_id': muid, 'name': 'QA-HH wrong owner ' + RUN}); ck(s in (401, 403) or s == 400, 'Editor cannot write a row under their own user id (outside the household)', (s, str(j)[:80]))

# ---- Phase 2: Editor against the owner's transaction (HH-39)
s, j = rest('PATCH', 'transactions', mtok, {'amount_minor': 1}, '?id=eq.' + To); ck(not rows(j) and s in (200, 204, 403), 'HH-39 Editor edit of owner transaction changes 0 rows', (s, len(rows(j))))
s, j = rest('DELETE', 'transactions', mtok, None, '?id=eq.' + To); ck(not rows(j) and s in (200, 204, 403), 'HH-39 Editor delete of owner transaction removes 0 rows', (s, len(rows(j))))
s, j = call('POST', '/rest/v1/transactions', mtok, {'id': To, 'user_id': ouid, 'wallet_id': Wo, 'type': 'expense', 'amount_minor': 2, 'note': 'QA-HH hijack'}, {'Prefer': 'resolution=merge-duplicates,return=representation'}); ck(s >= 400 or not rows(j), 'HH-39 Editor upsert over owner transaction is rejected', (s, str(j)[:100]))
s, j = rest('PATCH', 'transactions', mtok, {'wallet_id': ids_e['wallet']}, '?id=eq.' + To); ck(not rows(j), 'HH-39 Editor cannot move the owner transaction to another account', (s, len(rows(j))))
s, j = rest('PATCH', 'transactions', mtok, {'created_by': muid}, '?id=eq.' + To); ck(not rows(j), 'HH-39 Editor cannot claim the owner transaction (created_by)', (s, len(rows(j))))
s, j = rest('GET', 'transactions', otok, q='?id=eq.' + To + '&select=amount_minor,created_by,note'); ck(rows(j) and rows(j)[0]['amount_minor'] == 5000 and rows(j)[0]['created_by'] == ouid, 'HH-39 owner transaction unchanged after all attempts', j)
# HH-37 Editor edits own, rev increments
Te = ids_e['tx']; s, j0 = rest('GET', 'transactions', mtok, q='?id=eq.' + Te + '&select=rev,amount_minor,updated_by'); rev0 = rows(j0)[0]['rev']
s, j = rest('PATCH', 'transactions', mtok, {'amount_minor': 2000}, '?id=eq.' + Te); ck(s == 200 and len(rows(j)) == 1 and rows(j)[0]['amount_minor'] == 2000, 'HH-37 Editor edits own transaction', (s, len(rows(j))))
ck(rows(j)[0].get('updated_by') == muid, 'HH-23 updated_by = the Editor after an edit', rows(j)[0].get('updated_by'))
# HH-40 owner edits and deletes the Editor's transaction
s, j = rest('PATCH', 'transactions', otok, {'amount_minor': 3000}, '?id=eq.' + Te); ck(s == 200 and len(rows(j)) == 1 and rows(j)[0].get('updated_by') == ouid, 'HH-40 owner edits the Editor transaction; updated_by = owner', (s, len(rows(j))))
Tx2 = u(); ins(mtok, 'transactions', {'id': Tx2, 'user_id': ouid, 'wallet_id': Wo, 'type': 'expense', 'amount_minor': 7, 'note': 'QA-HH e2'})
s, j = rest('DELETE', 'transactions', otok, None, '?id=eq.' + Tx2); ck(s == 200 and len(rows(j)) == 1, 'HH-40 owner deletes the Editor transaction', (s, len(rows(j))))
# HH-44 / HH-45
s, j = rest('DELETE', 'wallets', mtok, None, '?id=eq.' + Wo); ck(not rows(j), 'HH-44 Editor cannot delete an account that holds the owner transactions', (s, str(j)[:160]))
HH44 = (s, str(j)[:200])
s, j = rest('GET', 'wallets', otok, q='?id=eq.' + Wo + '&select=id'); ck(len(rows(j)) == 1, 'HH-44 nothing deleted (query)')
s, j = rest('DELETE', 'categories', mtok, None, '?id=eq.' + Co); ck(not rows(j), 'HH-45 Editor cannot delete a category used by the owner transaction', (s, str(j)[:160]))
HH45 = (s, str(j)[:200])
s, j = rest('GET', 'categories', otok, q='?id=eq.' + Co + '&select=id'); ck(len(rows(j)) == 1, 'HH-45 nothing deleted (query)')
# Editor deletes own empty wallet and own category: allowed (no one else's transactions)
s, j = ins(mtok, 'wallets', {'id': (w2 := u()), 'user_id': ouid, 'name': 'QA-HH wallet e-empty ' + RUN})
s, j = rest('DELETE', 'wallets', mtok, None, '?id=eq.' + w2); ck(s == 200 and len(rows(j)) == 1, 'HH-44 Editor can delete an account with only their own or no transactions', (s, len(rows(j))))
s, j = ins(mtok, 'categories', {'id': (c2 := u()), 'user_id': ouid, 'name': 'QA-HH cat e-empty ' + RUN})
s, j = rest('DELETE', 'categories', mtok, None, '?id=eq.' + c2); ck(s == 200 and len(rows(j)) == 1, 'HH-45 Editor can delete a category nobody else uses', (s, len(rows(j))))
# Editor can still edit accounts/budgets/etc created by the owner (rule is transactions only)
s, j = rest('PATCH', 'wallets', mtok, {'name': 'QA-HH owner wallet ' + RUN + ' (edited by editor)'}, '?id=eq.' + Wo); ck(s == 200 and len(rows(j)) == 1, 'HH-18 Editor may edit an account created by the owner (rule covers transactions only)', (s, len(rows(j))))
print('HH-44 message:', HH44); print('HH-45 message:', HH45)

# ---- Phase 3: Viewer (HH-17, HH-30)
s, j = call('POST', '/rest/v1/rpc/set_member_role', otok, {'p_member': muid, 'p_role': 'viewer'}); ck(s in (200, 204), 'HH-19 owner sets the member to Viewer', (s, str(j)[:100]))
ids_v, plv = payloads(Wo, 'v1'); created['viewer_ids'] = ids_v
for t, row in plv:
    s, j = ins(mtok, t, row)
    ck(s in (401, 403) and not rows(j), 'HH-17 Viewer insert into ' + t + ' is rejected', (s, str(j)[:110]))
for t, rid in [('transactions', Te), ('wallets', ids_e['wallet']), ('categories', ids_e['cat']), ('debts', ids_e['debt']), ('budgets', ids_e['bud'])]:
    s, j = rest('PATCH', t, mtok, {'created_by': muid}, '?id=eq.' + rid); ck(not rows(j), 'HH-17 Viewer update on ' + t + ' changes 0 rows', (s, len(rows(j))))
    s, j = rest('DELETE', t, mtok, None, '?id=eq.' + rid); ck(not rows(j), 'HH-17 Viewer delete on ' + t + ' removes 0 rows', (s, len(rows(j))))
s, j = rest('GET', 'transactions', mtok, q='?select=id'); ck(s == 200 and len(rows(j)) >= 2, 'HH-17 Viewer can still read everything', len(rows(j)))
# ---- HH-30: non-owner management
s, j = fn('invite-member', mtok, {'email': 'qa-nobody@example.com', 'role': 'viewer'}); ck(s == 403, 'HH-30 Viewer cannot invite (edge function)', (s, str(j)[:80]))
s, j = call('POST', '/rest/v1/rpc/set_member_role', mtok, {'p_member': muid, 'p_role': 'editor'}); ck(s >= 400, 'HH-30 member cannot change their own role (promote self)', (s, str(j)[:120]))
s, j = call('POST', '/rest/v1/rpc/remove_member', mtok, {'p_member': ouid}); ck(s >= 400, 'HH-30 member cannot remove the owner', (s, str(j)[:120]))
s, j = rest('GET', 'household_members', otok, q='?select=member_id,role'); ck(any(m['member_id'] == muid and m['role'] == 'viewer' for m in rows(j)), 'HH-30 membership unchanged by the attempts (still viewer)')
s, j = rest('PATCH', 'household_members', mtok, {'role': 'editor'}, '?member_id=eq.' + muid); ck(not rows(j) and s in (200, 204, 401, 403), 'HH-30 direct table write to household_members changes nothing', (s, str(j)[:80]))
s, j = rest('POST', 'household_members', mtok, {'owner_id': ouid, 'member_id': u(), 'role': 'editor'}); ck(s in (401, 403), 'HH-30 direct insert into household_members is rejected', (s, str(j)[:100]))
print('\n'.join(R)); finish()
