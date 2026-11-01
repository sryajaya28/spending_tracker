#!/usr/bin/env python3
"""Dev server for the prototype: serves prototype/ and proxies Finnhub so the API key stays server-side.

  GET /api/status                     -> {"finnhub": true|false}
  GET /api/assets?q=&type=&limit=     -> matching assets from Finnhub's full US-stock and crypto lists
  GET /api/price?symbol=&type=&fh=    -> latest price in USD

The key is read from FINNHUB_API_KEY or ./.env.local and is never sent to the browser.
Symbol lists are cached in .cache/ for 24h (they are large and rarely change).
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "prototype"
CACHE_FILE = ROOT / ".cache" / "finnhub_assets.json"
CACHE_TTL = 24 * 3600
API = "https://finnhub.io/api/v1"
CRYPTO_EXCHANGES = ["binance", "coinbase"]   # base assets are merged across these
CRYPTO_QUOTES = ("USDT", "USD", "USDC")


def load_key():
    key = os.environ.get("FINNHUB_API_KEY", "").strip()
    env = ROOT / ".env.local"
    if not key and env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("FINNHUB_API_KEY="):
                key = line.split("=", 1)[1].strip().strip("\"'")
    return key


KEY = load_key()


def finnhub(path, **params):
    url = f"{API}{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"X-Finnhub-Token": KEY, "User-Agent": "stiver-dev"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def build_assets():
    assets = []
    for s in finnhub("/stock/symbol", exchange="US"):
        sym = (s.get("symbol") or "").strip()
        # keep plain tickers; skip share classes / warrants that are awkward to hold
        if not sym or not sym.replace("-", "").isalnum():
            continue
        kind = "etf" if s.get("type") == "ETP" else "stock"
        assets.append({"symbol": sym.upper(), "name": s.get("description") or sym, "type": kind, "fh": sym})
    seen = {}
    for ex in CRYPTO_EXCHANGES:
        try:
            pairs = finnhub("/crypto/symbol", exchange=ex)
        except Exception:
            continue
        for p in pairs:
            disp = p.get("displaySymbol") or ""
            if "/" not in disp:
                continue
            base, quote = disp.split("/", 1)
            if quote not in CRYPTO_QUOTES or not base.isalnum():
                continue
            prev = seen.get(base.upper())
            # prefer USDT/USD pairs; first exchange wins ties
            if prev is None or (prev["quote"] != "USDT" and quote == "USDT"):
                seen[base.upper()] = {"symbol": base.upper(), "name": base.upper(), "type": "crypto", "fh": p.get("symbol"), "quote": quote}
    kinds = {"BTC": "Bitcoin", "ETH": "Ethereum", "SOL": "Solana", "USDT": "Tether", "USDC": "USD Coin", "XRP": "XRP", "DOGE": "Dogecoin", "ADA": "Cardano", "BNB": "BNB"}
    for base, a in seen.items():
        a["name"] = kinds.get(base, base)
        if base in ("USDT", "USDC"):
            a["type"] = "stablecoin"
        assets.append({k: v for k, v in a.items() if k != "quote"})
    # Every asset gets a unique key. Crypto keeps its plain symbol; a stock/ETF that shares a symbol
    # with a crypto asset (e.g. BTC = Bitcoin vs a Bitcoin ETF) gets ".US" so holdings never collide.
    crypto_syms = {a["symbol"] for a in assets if a["type"] in ("crypto", "stablecoin")}
    for a in assets:
        a["key"] = a["symbol"] + ".US" if a["type"] in ("stock", "etf") and a["symbol"] in crypto_syms else a["symbol"]
    return assets


_assets = None


def get_assets():
    global _assets
    if _assets is not None:
        return _assets
    if CACHE_FILE.exists() and time.time() - CACHE_FILE.stat().st_mtime < CACHE_TTL:
        _assets = json.loads(CACHE_FILE.read_text())
        return _assets
    _assets = build_assets()
    CACHE_FILE.parent.mkdir(exist_ok=True)
    CACHE_FILE.write_text(json.dumps(_assets))
    return _assets


def search(q, kind, limit):
    q = q.strip().upper()
    if not q:
        return []
    exact, prefix, contains = [], [], []
    for a in get_assets():
        if kind == "crypto" and a["type"] not in ("crypto", "stablecoin"):
            continue
        if kind == "stock" and a["type"] not in ("stock", "etf"):
            continue
        sym, name = a["symbol"], a["name"].upper()
        if sym == q:
            exact.append(a)
        elif sym.startswith(q):
            prefix.append(a)
        elif q in name:
            contains.append(a)
    is_crypto = lambda a: a["type"] in ("crypto", "stablecoin")
    exact.sort(key=lambda a: not is_crypto(a))          # Bitcoin before a Bitcoin ETF
    prefix.sort(key=lambda a: (not is_crypto(a), len(a["symbol"])))
    return (exact + prefix + contains)[:limit]


def price(symbol, kind, fh):
    return cached_price(("fh", symbol, kind, fh), lambda: _price(symbol, kind, fh))


def _price(symbol, kind, fh):
    # stocks/ETFs quote by ticker; crypto by the exchange-qualified pair (e.g. BINANCE:BTCUSDT)
    if not fh:
        want_crypto = kind == "crypto"
        for a in get_assets():
            if a["symbol"] == symbol.upper() and (a["type"] in ("crypto", "stablecoin")) == want_crypto:
                fh = a["fh"]
                break
    q = finnhub("/quote", symbol=fh or symbol)
    if not q.get("c"):
        raise ValueError("no price returned for this symbol")
    return float(q["c"])


# ---------------------------------------------------------------------------------------------
# Indonesian stocks (IDX) and commodities, priced through Yahoo Finance's public (unofficial) endpoints.
# No key is needed, but it is not an official API: it can change, rate-limit, or refuse some server IPs.
# Everything here is best effort: a failure only means "price unavailable" in the app (a typed-in price still works).
YH = "https://query1.finance.yahoo.com"
OZ_G = 31.1034768   # grams per troy ounce

# [key, name, Yahoo symbol, multiplier applied to the Yahoo price]
COMMODITIES = [
    ("XAU", "Gold (per troy oz)", "GC=F", 1.0), ("XAUG", "Gold (per gram)", "GC=F", 1 / OZ_G),
    ("XAG", "Silver (per troy oz)", "SI=F", 1.0), ("XAGG", "Silver (per gram)", "SI=F", 1 / OZ_G),
    ("XPT", "Platinum (per troy oz)", "PL=F", 1.0), ("WTI", "Crude oil WTI (per barrel)", "CL=F", 1.0),
    ("BRENT", "Crude oil Brent (per barrel)", "BZ=F", 1.0), ("NG", "Natural gas (per MMBtu)", "NG=F", 1.0),
    ("HG", "Copper (per lb)", "HG=F", 1.0),
]
# well-known IDX tickers, so search works even when Yahoo's search is unreachable
IDX_COMMON = [
    ("BBCA", "Bank Central Asia"), ("BBRI", "Bank Rakyat Indonesia"), ("BMRI", "Bank Mandiri"), ("BBNI", "Bank Negara Indonesia"),
    ("BRIS", "Bank Syariah Indonesia"), ("TLKM", "Telkom Indonesia"), ("ASII", "Astra International"), ("UNVR", "Unilever Indonesia"),
    ("GOTO", "GoTo Gojek Tokopedia"), ("BREN", "Barito Renewables Energy"), ("AMMN", "Amman Mineral Internasional"), ("ICBP", "Indofood CBP Sukses Makmur"),
    ("INDF", "Indofood Sukses Makmur"), ("ADRO", "Alamtri Resources Indonesia"), ("ANTM", "Aneka Tambang"), ("MDKA", "Merdeka Copper Gold"),
    ("PGAS", "Perusahaan Gas Negara"), ("KLBF", "Kalbe Farma"), ("SMGR", "Semen Indonesia"), ("CPIN", "Charoen Pokphand Indonesia"),
    ("TPIA", "Chandra Asri Pacific"), ("MAPI", "Mitra Adiperkasa"), ("EXCL", "XL Axiata"), ("ISAT", "Indosat Ooredoo Hutchison"),
    ("INKP", "Indah Kiat Pulp & Paper"), ("PTBA", "Bukit Asam"), ("ITMG", "Indo Tambangraya Megah"), ("MEDC", "Medco Energi Internasional"),
    ("ACES", "Aspirasi Hidup Indonesia"), ("ARTO", "Bank Jago"), ("BUKA", "Bukalapak.com"), ("EMTK", "Elang Mahkota Teknologi"),
]


# Live prices (Finnhub and Yahoo) are kept for 6 hours, like the exchange rates, so the app shows one consistent
# "updated every 6 hours" rhythm and the upstream services are called rarely. Responses also tell Vercel's edge
# cache to hold them for 6 hours.
PRICE_TTL = 6 * 3600
_price_cache = {}


def cached_price(key, fn):
    hit = _price_cache.get(key)
    if hit and time.time() - hit[0] < PRICE_TTL:
        return hit[1]
    val = fn()
    _price_cache[key] = (time.time(), val)
    return val


def yahoo_get(path, **params):
    url = f"{YH}{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; stiver)", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=12) as r:
        return json.load(r)


def asset_idx(code, name):
    code = code.upper().removesuffix(".JK")
    return {"key": f"{code}.JK", "symbol": code, "name": name, "type": "stock", "yh": f"{code}.JK", "mult": 1.0}


def asset_commodity(row):
    return {"key": row[0], "symbol": row[0], "name": row[1], "type": "commodity", "yh": row[2], "mult": row[3]}


def search_commodities(q, limit):
    q = q.strip().upper()
    out = [asset_commodity(r) for r in COMMODITIES if not q or q in r[0] or q in r[1].upper() or q in r[2]]
    # people search by everyday words too
    words = {"EMAS": "XAU", "PERAK": "XAG", "MINYAK": "WTI", "OIL": "WTI", "GOLD": "XAU", "SILVER": "XAG"}
    for w, key in words.items():
        if q and (q in w or w in q):
            for r in COMMODITIES:
                if r[0].startswith(key) and all(o["key"] != r[0] for o in out):
                    out.append(asset_commodity(r))
    return out[:limit]


def search_idx(q, limit, live=True):
    q = q.strip().upper()
    if not q:
        return []
    out = [asset_idx(c, n) for c, n in IDX_COMMON if c.startswith(q) or q in n.upper()]
    if live and len(out) < limit:
        try:
            j = yahoo_get("/v1/finance/search", q=q, quotesCount=15, newsCount=0, lang="en-US")
            for it in j.get("quotes", []):
                sym = it.get("symbol", "")
                if sym.endswith(".JK") and it.get("quoteType") in ("EQUITY", "ETF") and all(o["yh"] != sym for o in out):
                    out.append(asset_idx(sym, it.get("longname") or it.get("shortname") or sym))
        except Exception:
            pass   # Yahoo search unreachable: the built-in list above still works
    return out[:limit]


def yahoo_price(yh, mult):
    return cached_price(("yh", yh, mult), lambda: _yahoo_price(yh, mult))


def _yahoo_price(yh, mult):
    j = yahoo_get(f"/v8/finance/chart/{urllib.parse.quote(yh)}", range="5d", interval="1d")
    res = (j.get("chart", {}).get("result") or [None])[0]
    if not res:
        raise ValueError("no price returned for this symbol")
    meta = res["meta"]
    p = meta.get("regularMarketPrice")
    if not p:
        raise ValueError("no price returned for this symbol")
    cur = meta.get("currency") or "USD"
    native = float(p) * mult
    if cur == "GBp":          # pence
        native, cur = native / 100, "GBP"
    usd = native if cur == "USD" else native / fx_rates([cur])["rates"][cur]
    return {"price": usd, "native": native, "currency": cur}


# Fiat exchange rates (units per 1 USD). Finnhub's free plan has no forex data (403, and no IDR pair),
# so use free public sources, tried in order, cached for 6 hours.
FX_SOURCES = [
    ("frankfurter", "https://api.frankfurter.dev/v1/latest?base=USD", lambda j: (j["rates"], j.get("date"))),
    ("open.er-api", "https://open.er-api.com/v6/latest/USD", lambda j: (j["rates"], (j.get("time_last_update_utc") or "")[:16])),
]
_fx = {"at": 0, "data": None}


def fx_rates(want):
    if not _fx["data"] or time.time() - _fx["at"] > 6 * 3600:
        last = "no source reachable"
        for name, url, parse in FX_SOURCES:
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "stiver-dev"})
                with urllib.request.urlopen(req, timeout=15) as r:
                    rates, date = parse(json.load(r))
                rates["USD"] = 1.0
                if "IDR" in rates:
                    _fx["data"], _fx["at"] = {"source": name, "date": date, "rates": rates}, time.time()
                    break
                last = f"{name} has no IDR"
            except Exception as e:
                last = f"{name}: {e}"
        else:
            raise ValueError(last)
    d = _fx["data"]
    return {**d, "rates": {c: d["rates"][c] for c in want if c in d["rates"]} if want else d["rates"]}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(WEB), **kw)

    def send_json(self, obj, status=200, cache=0):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", f"public, s-maxage={cache}" if cache and status == 200 else "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if not u.path.startswith("/api/"):
            return super().do_GET()
        qs = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        try:
            if u.path == "/api/status":
                return self.send_json({"finnhub": bool(KEY), "yahoo": True})
            if u.path == "/api/fx":
                # fiat rates need no Finnhub key (its free tier has no forex/IDR data)
                want = [c for c in qs.get("currencies", "").upper().split(",") if c]
                return self.send_json(fx_rates(want), cache=PRICE_TTL)
            if u.path == "/api/price" and qs.get("yh"):   # IDX stocks and commodities (no key needed)
                return self.send_json(yahoo_price(qs["yh"], float(qs.get("mult") or 1)), cache=PRICE_TTL)
            if u.path == "/api/assets" and qs.get("type") in ("idx", "commodity"):
                limit = max(1, min(int(qs.get("limit", 20)), 50))
                q = qs.get("q", "")
                return self.send_json({"results": search_idx(q, limit) if qs["type"] == "idx" else search_commodities(q, limit)})
            if not KEY:
                return self.send_json({"error": "FINNHUB_API_KEY is not set in .env.local"}, 503)
            if u.path == "/api/assets":
                limit = max(1, min(int(qs.get("limit", 20)), 50))
                found = search(qs.get("q", ""), qs.get("type", ""), limit)
                if not qs.get("type") and qs.get("q"):   # "All" also offers matching commodities and well-known IDX stocks
                    found = (found + search_commodities(qs["q"], 5) + search_idx(qs["q"], 5, live=False))[:limit]
                return self.send_json({"results": found})
            if u.path == "/api/price":
                return self.send_json({"price": price(qs.get("symbol", ""), qs.get("type", ""), qs.get("fh"))}, cache=PRICE_TTL)
            return self.send_json({"error": "not found"}, 404)
        except urllib.error.HTTPError as e:
            return self.send_json({"error": f"Finnhub returned {e.code}"}, 502)
        except Exception as e:  # never leak internals or the key
            return self.send_json({"error": str(e)[:160]}, 502)

    def log_message(self, fmt, *args):
        line = fmt % args
        if "/api/" in line:
            sys.stderr.write("api " + line.split('"')[1] + "\n")


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    print(f"serving {WEB} on http://localhost:{port}  (Finnhub key {'loaded' if KEY else 'MISSING'})")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
