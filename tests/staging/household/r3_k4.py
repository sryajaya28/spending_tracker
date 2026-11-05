import os, json
from sb import *
st = json.load(open('state.json')); otok, ouid = login('smoke.staging@stiver.io', os.environ['SMOKE_STAGING_PASSWORD'])
tok2 = open('m2_tok.txt').read().strip()
s, j = fn('join-household', None, {'action': 'preview', 'token': tok2}); print('M2 link before revoke:', s, j.get('role'))
s, j = fn('manage-invite', otok, {'action': 'revoke', 'invite_id': st['m2_invite']}); print('revoke M2:', s, j)
s, j = fn('join-household', None, {'action': 'preview', 'token': tok2}); print('M2 link after revoke:', s, j)
s, lst = rest('GET', 'household_invites', otok, q='?status=eq.pending&select=email'); print('pending after revoke:', sorted(i['email'].split('@')[0][:9] for i in lst))
s, j = fn('join-household', None, {'action': 'join', 'token': tok2, 'password': 'Whatever123!', 'display_name': 'X'}); print('join attempt with the revoked link:', s, j)
