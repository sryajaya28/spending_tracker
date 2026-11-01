"""Server-side checks for the IDX / commodity price source (no network: Yahoo is stubbed).
Run: python3 tests/test_yahoo.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
import dev_server as d  # noqa: E402

calls = []


def fake_get(path, **params):
    calls.append((path, params))
    if path.startswith("/v8/finance/chart/GC%3DF") or path.startswith("/v8/finance/chart/GC=F"):
        return {"chart": {"result": [{"meta": {"regularMarketPrice": 3110.348, "currency": "USD"}}]}}
    if path.startswith("/v8/finance/chart/BBCA.JK"):
        return {"chart": {"result": [{"meta": {"regularMarketPrice": 9000, "currency": "IDR"}}]}}
    if path.startswith("/v8/finance/chart/NONE"):
        return {"chart": {"result": None}}
    if path == "/v1/finance/search":
        return {"quotes": [{"symbol": "BBTN.JK", "quoteType": "EQUITY", "longname": "Bank Tabungan Negara"}, {"symbol": "BBTN", "quoteType": "EQUITY"}, {"symbol": "AAPL", "quoteType": "EQUITY"}]}
    raise AssertionError(path)


d.yahoo_get = fake_get
d.fx_rates = lambda want: {"rates": {"IDR": 18000.0, "USD": 1.0}}

# commodities: gold per gram = ounce price / 31.1034768
g = d.yahoo_price("GC=F", 1 / d.OZ_G)
assert abs(g["price"] - 100.0) < 0.01 and g["currency"] == "USD", g
# IDX is quoted in rupiah and converted to USD with the fx rate
b = d.yahoo_price("BBCA.JK", 1.0)
assert b["native"] == 9000 and b["currency"] == "IDR" and abs(b["price"] - 0.5) < 1e-9, b
try:
    d.yahoo_price("NONE", 1.0); raise SystemExit("expected an error for an unknown symbol")
except ValueError:
    pass
# search
assert [a["key"] for a in d.search_idx("bbc", 10, live=False)] == ["BBCA.JK"]
live = d.search_idx("bbtn", 10)
assert any(a["key"] == "BBTN.JK" and a["name"] == "Bank Tabungan Negara" for a in live) and all(a["key"].endswith(".JK") for a in live), live
cm = d.search_commodities("gold", 10); assert [a["key"] for a in cm] == ["XAU", "XAUG"] and cm[0]["type"] == "commodity" and cm[1]["mult"] < 0.04, cm
assert d.search_commodities("emas", 10)[0]["key"] == "XAU" and any(a["key"] == "BRENT" for a in d.search_commodities("oil", 10))
# prices are cached for 6 hours: a second request does not call Yahoo again; after the TTL it does
n = len(calls); d.yahoo_price("BBCA.JK", 1.0); assert len(calls) == n, "second call must come from the cache"
d.yahoo_price("BBCA.JK", 1.0)
for k in list(d._price_cache): d._price_cache[k] = (d._price_cache[k][0] - d.PRICE_TTL - 1, d._price_cache[k][1])
d.yahoo_price("BBCA.JK", 1.0); assert len(calls) == n + 1, "after 6 hours it refetches"
print("ok")
