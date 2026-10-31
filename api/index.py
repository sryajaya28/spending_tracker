"""Vercel serverless entry point: the same /api/* endpoints as tools/dev_server.py.

  GET /api/status, /api/fx, /api/assets, /api/price

Reuses the dev server's handler so local and hosted behaviour stay identical. The Finnhub key comes
from the FINNHUB_API_KEY environment variable (set it in the Vercel project settings, never in the repo).
The deployment filesystem is read-only except /tmp, so the symbol-list cache lives there.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

import dev_server  # noqa: E402

dev_server.CACHE_FILE = Path("/tmp/finnhub_assets.json")


class handler(dev_server.Handler):  # Vercel looks for a class named `handler`
    pass
