from __future__ import annotations

import asyncio
from typing import Any, Dict

import httpx

from ..settings import Settings


class SignalClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def get_market_context(self) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=10) as client:
            tickers_task = asyncio.gather(
                self._fetch_ticker(client, "BTCUSDT"),
                self._fetch_ticker(client, "MNTUSDT"),
            )
            funding_task = asyncio.gather(
                self._fetch_funding(client, "BTCUSDT"),
                self._fetch_funding(client, "MNTUSDT"),
            )
            tickers, funding = await asyncio.gather(tickers_task, funding_task)

        return {
            "tickers": {"BTCUSDT": tickers[0], "MNTUSDT": tickers[1]},
            "funding": {"BTCUSDT": funding[0], "MNTUSDT": funding[1]},
        }

    async def _fetch_ticker(
        self, client: httpx.AsyncClient, symbol: str
    ) -> Dict[str, Any]:
        url = f"{self._settings.bybit_base_url}/v5/market/tickers"
        params = {"category": "spot", "symbol": symbol}
        response = await client.get(url, params=params)
        response.raise_for_status()
        payload = response.json()
        items = payload.get("result", {}).get("list", [])
        if not items:
            return {"symbol": symbol}

        item = items[0]
        return {
            "symbol": symbol,
            "last_price": float(item.get("lastPrice", 0) or 0),
            "volume_24h": float(item.get("volume24h", 0) or 0),
            "turnover_24h": float(item.get("turnover24h", 0) or 0),
            "price_change_pct": float(item.get("price24hPcnt", 0) or 0),
        }

    async def _fetch_funding(
        self, client: httpx.AsyncClient, symbol: str
    ) -> Dict[str, Any]:
        url = f"{self._settings.bybit_base_url}/v5/market/funding/history"
        params = {"category": "linear", "symbol": symbol, "limit": 1}
        response = await client.get(url, params=params)
        response.raise_for_status()
        payload = response.json()
        items = payload.get("result", {}).get("list", [])
        if not items:
            return {"symbol": symbol}

        item = items[0]
        return {
            "symbol": symbol,
            "funding_rate": float(item.get("fundingRate", 0) or 0),
            "funding_time": item.get("fundingRateTimestamp"),
        }
