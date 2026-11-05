import os, json, ssl, urllib.request, urllib.error
URL = 'https://cujmgyacxbcmltxfjkxo.supabase.co'
ANON = 'sb_publishable_BFRR-eAyMNAJtX52EN0ydQ_Teb0Q71G'
CTX = ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt')
def call(method, path, token=None, body=None, extra=None):
    h = {'apikey': ANON, 'Content-Type': 'application/json'}
    if token: h['Authorization'] = 'Bearer ' + token
    if extra: h.update(extra)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(URL + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=60) as r:
            t = r.read().decode(); return r.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        t = e.read().decode()
        try: return e.code, json.loads(t)
        except Exception: return e.code, t
def login(email, pw):
    s, j = call('POST', '/auth/v1/token?grant_type=password', body={'email': email, 'password': pw})
    assert s == 200, ('login failed', s)
    return j['access_token'], j['user']['id']
def rest(method, table, token, body=None, q='', prefer='return=representation'):
    return call(method, '/rest/v1/' + table + q, token, body, {'Prefer': prefer})
def fn(name, token, body):
    return call('POST', '/functions/v1/' + name, token, body)
