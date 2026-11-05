import os, sys, json, time
from sb import *; import mail
st = json.load(open('state.json')); R = []
def ck(ok, name, d=''):
    R.append(('PASS ' if ok else 'FAIL ') + name + (('  ' + str(d)[:240]) if d != '' else ''))
    if not ok: print('\n'.join(R)); print('STOPPED AT FIRST FAILURE'); json.dump(st, open('state.json', 'w')); sys.exit(1)
otok, ouid = login('smoke.staging@stiver.io', os.environ['SMOKE_STAGING_PASSWORD'])
tokB = open('m3_tokB.txt').read().strip(); s, j = fn('join-household', None, {'action': 'preview', 'token': tokB}); ck(s == 200 and j.get('role') == 'viewer', 'HH-03 (re-check) the new M3 link still previews the Viewer role', (s, str(j)[:70]))
def safe(f, *a):
    for i in range(8):
        try: return f(*a)
        except Exception as e:
            if '429' in str(e): time.sleep(20); continue
            raise
    return None
ib = safe(mail.inbox, st['m4']); msgs = (ib or {}).get('msgs', []); ck(bool(msgs), 'M4 (Indonesian owner) email is in the inbox', len(msgs))
msg = safe(mail.message, st['m4'], msgs[0]['id']); tx = ' '.join(mail.text_of(msg).split()); print('M4 subject:', msgs[0].get('subject')); print('M4 body:', tx[:320])
ck(bool(mail.link_from(msg)), 'M4 email has the join link')
subj = msgs[0].get('subject') or ''; ck("You're invited" not in subj, 'HH-08 the Indonesian invite has an Indonesian subject', subj)
n5 = 'qa-hh-m5-' + st['tag']; s, j = fn('invite-member', otok, {'email': n5 + '@mailinator.com', 'role': 'viewer'}); print('M5 answer:', s, j)
ck(s != 200 and (j or {}).get('result') not in ('ok', 'rate_limited'), 'HH-05 the 6th person is refused with the CAP answer, not the hourly limit', (s, str(j)[:120])); st['cap_answer'] = [s, j]
s, lst = rest('GET', 'household_invites', otok, q='?status=eq.pending&select=id'); ck(len(lst) == 3, 'HH-05 nothing was created for the refused invite (3 pending)', len(lst))
json.dump(st, open('state.json', 'w')); print('\n'.join(R))
