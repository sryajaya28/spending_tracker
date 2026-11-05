import json, re, ssl, time, urllib.request
CTX = ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt')
def _get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'stiver-qa'}), context=CTX, timeout=40) as r: return json.loads(r.read().decode())
def inbox(name): return _get('https://www.mailinator.com/api/v2/domains/public/inboxes/' + name)
def message(name, mid): return _get('https://www.mailinator.com/api/v2/domains/public/inboxes/%s/messages/%s' % (name, mid))
def wait_mail(name, after=0, tries=24):
    for _ in range(tries):
        try:
            for m in inbox(name).get('msgs', []):
                if m.get('time', 0) > after: return m
        except Exception as e: err = str(e)
        time.sleep(5)
    return None
def link_from(msg):
    body = ' '.join(p.get('body', '') for p in msg.get('parts', [])) + ' ' + str(msg.get('subject', ''))
    m = re.search(r'https://staging\.stiver\.io/join#t=([A-Za-z0-9_-]+)', body); return m.group(1) if m else None
def text_of(msg): return re.sub(r'<[^>]+>', ' ', ' '.join(p.get('body', '') for p in msg.get('parts', []))).replace('&#39;', "'")
