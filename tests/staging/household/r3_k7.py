import os, json, uuid, base64
from sb import *
otok, ouid = login('smoke.staging@stiver.io', os.environ['SMOKE_STAGING_PASSWORD']); email = 'qa-hh-m4-a8cd6@mailinator.com'; pw = 'Atk' + uuid.uuid4().hex[:10] + '!'
s, j = call('POST', '/auth/v1/signup', body={'email': email, 'password': pw, 'data': {'full_name': 'Direct'}})
print('direct sign-up with an invited, unconfirmed address:', s, 'keys:', sorted(j.keys()) if isinstance(j, dict) else str(j)[:100])
tok = (j or {}).get('access_token')
if not tok: print('no session returned'); raise SystemExit
claims = json.loads(base64.urlsafe_b64decode(tok.split('.')[1] + '==')); uid = claims['sub']
print('session email:', claims.get('email'), '| same invited login:', claims.get('email') == email, '| aal:', claims.get('aal'), '| amr:', claims.get('amr'))
for t, q in [('wallets', '?select=id'), ('transactions', '?select=id'), ('categories', '?select=id'), ('household_state', '?select=owner_id'), ('household_members', '?select=role')]:
    s2, r = rest('GET', t, tok, q=q); print('  read', t, s2, len(r) if isinstance(r, list) else str(r)[:80])
s2, r = rest('GET', 'profiles', tok, q='?select=household_status'); print('  own profile:', s2, r)
for val in ('member', 'owner'):
    s2, r = rest('PATCH', 'profiles', tok, {'household_status': val}, '?id=eq.' + uid); print('  try to set own household_status =', val, '->', s2, str(r)[:110])
s2, r = rest('POST', 'wallets', tok, {'id': str(uuid.uuid4()), 'user_id': ouid, 'name': 'QA-HH takeover'}); print('  write into the owner household:', s2, str(r)[:90])
s2, r = rest('POST', 'wallets', tok, {'id': str(uuid.uuid4()), 'user_id': uid, 'name': 'QA-HH own ledger'}); print('  create an own ledger row:', s2, str(r)[:90])
s, j = call('POST', '/auth/v1/token?grant_type=password', body={'email': email, 'password': pw}); print('password sign-in afterwards:', s, '(200 = the sign-up set a usable password)')
s, r = rest('GET', 'household_state', otok, q='?select=has_members'); print('owner household unchanged:', r)
