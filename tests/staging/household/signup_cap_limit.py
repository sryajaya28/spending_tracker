import os, sys, json, uuid
from sb import *
R = []; invites = []
def finish():
    json.dump({'invites': invites}, open('invites.json', 'w'))
def ck(ok, name, detail=''):
    R.append(('PASS ' if ok else 'FAIL ') + name + (('  ' + str(detail)[:230]) if detail != '' else ''))
    if not ok:
        print('\n'.join(R)); print('STOPPED AT FIRST FAILURE'); finish(); sys.exit(1)
otok, ouid = login('smoke.staging@stiver.io', os.environ['SMOKE_STAGING_PASSWORD'])
# ---- HH-31: a normal sign-up whose metadata claims a household gets no access
spoof = 'qa-hh31-' + uuid.uuid4().hex[:6] + '@mailinator.com'
s, j = call('POST', '/auth/v1/signup', body={'email': spoof, 'password': 'Qa' + uuid.uuid4().hex[:10] + '!', 'data': {'household_owner': ouid, 'owner_id': ouid, 'household_id': ouid, 'role': 'editor', 'household_status': 'member', 'email_verified': True}})
ck(s in (200, 201), 'HH-31 spoofed sign-up (metadata claims the household) is accepted as a normal account', (s, str(j)[:100]))
stok = (j or {}).get('access_token'); sid = ((j or {}).get('user') or {}).get('id') or (j or {}).get('id')
ck(bool(stok), 'HH-31 the spoof account got a session (confirm email is off on staging)', bool(stok))
s, w = rest('GET', 'wallets', otok, q='?select=id&limit=1'); owner_wallet = w[0]['id']
for t in ['wallets', 'transactions', 'categories', 'debts', 'budgets']:
    s, r = rest('GET', t, stok, q='?select=id,user_id'); ck(s == 200 and all(x.get('user_id') != ouid for x in (r or [])), 'HH-31 spoofed account cannot read the owner\'s ' + t, (s, len(r or [])))
s, r = rest('GET', 'household_members', stok, q='?select=member_id'); ck(not r, 'HH-31 spoofed account is in no household', (s, r))
s, r = rest('POST', 'transactions', stok, {'id': str(uuid.uuid4()), 'user_id': ouid, 'wallet_id': owner_wallet, 'type': 'expense', 'amount_minor': 1, 'note': 'QA-HH spoof write'}); ck(s in (401, 403, 409) and not (isinstance(r, list) and r), 'HH-31 spoofed account cannot write into the owner\'s household', (s, str(r)[:100]))
s, r = rest('GET', 'transactions', otok, q='?note=eq.QA-HH%20spoof%20write&select=id'); ck(not r, 'HH-31 nothing was written to the owner (query)')
s, r = rest('GET', 'household_state', otok, q='?select=has_members'); ck(r and r[0]['has_members'] is False, 'HH-31 the owner household has no members after the spoof attempt', r)
spoof_id = sid
# ---- HH-02: existing account, any letter case, refused; nothing sent; same answer
for em in ['smoke.staging@stiver.io', 'SMOKE.Staging@Stiver.IO', ' smoke.staging@stiver.io ']:
    s, j = fn('invite-member', otok, {'email': em, 'role': 'viewer'}); ck(j and (j.get('result') == 'cannot_invite' or j.get('error') == 'cannot_invite'), 'HH-02 existing account %r is refused with the generic answer' % em, (s, str(j)[:90]))
s, j = fn('invite-member', otok, {'email': 'not-an-email', 'role': 'viewer'}); ck(s == 400, 'HH-04 invalid email is refused (400)', (s, str(j)[:90]))
s, j = fn('invite-member', otok, {'email': 'qa-role@mailinator.com', 'role': 'owner'}); ck(s == 400, 'HH-04 invalid role is refused (400)', (s, str(j)[:90]))
# ---- HH-05: cap of 5 (owner + members + pending), Mailinator invitees (emails go to public inboxes, unread)
for i in range(1, 5):
    s, j = fn('invite-member', otok, {'email': 'qa-hh-cap%d-%s@mailinator.com' % (i, uuid.uuid4().hex[:4]), 'role': 'viewer'})
    if s == 429: ck(False, 'HH-05 setup invite %d hit the hourly invite limit before the cap test' % i, (s, str(j)[:120]))
    ck(s == 200 and j.get('result') == 'ok', 'HH-05 setup: invite %d of 4 to a Mailinator address' % i, (s, str(j)[:100])); invites.append(j['invite_id'])
s, j = fn('invite-member', otok, {'email': 'qa-hh-cap5-%s@mailinator.com' % uuid.uuid4().hex[:4], 'role': 'viewer'}); ck(s != 200 and (j or {}).get('result') != 'ok', 'HH-05 the 5th pending invite (household would be 6) is refused', (s, str(j)[:140]))
CAP = (s, str(j)[:160])
# ---- HH-21: revoke removes it from the list and frees a place
s, lst = rest('GET', 'household_invites', otok, q='?status=eq.pending&select=id'); ck(len(lst) == 4, 'HH-21 the 4 pending invites are listed', len(lst))
for iid in invites:
    s, j = fn('manage-invite', otok, {'action': 'revoke', 'invite_id': iid}); ck(s == 200 and j.get('result') == 'ok', 'HH-21 revoke invite', (s, str(j)[:80]))
s, lst = rest('GET', 'household_invites', otok, q='?status=eq.pending&select=id'); ck(len(lst) == 0, 'HH-21 revoked invites leave the pending list', len(lst))
# ---- HH-30: the hourly invite limit (existing-account answers send no mail but count)
hit = None
for n in range(1, 16):
    s, j = fn('invite-member', otok, {'email': 'smoke.staging@stiver.io', 'role': 'viewer'})
    if s == 429 or (j and j.get('result') == 'rate_limited'): hit = n; break
ck(hit is not None, 'HH-30 the hourly invite limit applies (a 429 / rate_limited answer)', 'after %s further attempts: %s' % (hit, str(j)[:100]))
print('\n'.join(R)); print('CAP answer:', CAP); print('spoof user id:', spoof_id, spoof); json.dump({'spoof_email': spoof, 'spoof_id': spoof_id}, open('spoof.json', 'w')); finish()
