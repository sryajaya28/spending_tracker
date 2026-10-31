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
    req = urllib.request.Request(url, headers={"X-Finnhub-Token": KEY, "User-Agent": "spendly-dev"})
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
                req = urllib.request.Request(url, headers={"User-Agent": "spendly-dev"})
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

    def send_json(self, obj, status=200):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if not u.path.startswith("/api/"):
            return super().do_GET()
        qs = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        try:
            if u.path == "/api/status":
                return self.send_json({"finnhub": bool(KEY)})
            if u.path == "/api/fx":
                # fiat rates need no Finnhub key (its free tier has no forex/IDR data)
                want = [c for c in qs.get("currencies", "").upper().split(",") if c]
                return self.send_json(fx_rates(want))
            if not KEY:
                return self.send_json({"error": "FINNHUB_API_KEY is not set in .env.local"}, 503)
            if u.path == "/api/assets":
                limit = max(1, min(int(qs.get("limit", 20)), 50))
                return self.send_json({"results": search(qs.get("q", ""), qs.get("type", ""), limit)})
            if u.path == "/api/price":
                return self.send_json({"price": price(qs.get("symbol", ""), qs.get("type", ""), qs.get("fh"))})
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
