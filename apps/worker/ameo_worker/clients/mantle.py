from __future__ import annotations

import logging
from decimal import Decimal
from typing import Callable, Dict, List, Optional, Tuple, TypeVar

import certifi
from web3 import Web3

from ..settings import Settings

logger = logging.getLogger(__name__)

T = TypeVar("T")

_ERC20_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "decimals", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "symbol", "type": "string"}],
        "stateMutability": "view",
        "type": "function",
    },
]

_DEFAULT_RPCS = [
    "https://rpc.sepolia.mantle.xyz",
    "https://rpc.ankr.com/mantle_sepolia",
]


def _rpc_candidates(settings: Settings) -> List[str]:
    urls = [settings.mantle_rpc_url]
    if settings.mantle_rpc_url_fallback:
        urls.append(settings.mantle_rpc_url_fallback)
    urls.extend(_DEFAULT_RPCS)
    seen: set[str] = set()
    ordered: List[str] = []
    for url in urls:
        if url and url not in seen:
            seen.add(url)
            ordered.append(url)
    return ordered


def _wei_to_decimal(raw: int, decimals: int) -> Decimal:
    return Decimal(raw) / Decimal(10**decimals)


def _decimal_to_api(value: Decimal) -> float:
    """Serialize Decimal balances for JSON APIs with stable precision."""
    return float(value.quantize(Decimal("1e-12")))


class MantleClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._rpcs = _rpc_candidates(settings)
        self._rpc_index = 0
        self._w3: Web3 | None = None
        self._active_rpc = ""
        self._connect(self._rpc_index)

    def _connect(self, index: int) -> None:
        timeout = int(self._settings.http_timeout_sec)
        for offset in range(len(self._rpcs)):
            idx = (index + offset) % len(self._rpcs)
            rpc = self._rpcs[idx]
            w3 = Web3(
                Web3.HTTPProvider(
                    rpc,
                    request_kwargs={"timeout": timeout, "verify": certifi.where()},
                )
            )
            try:
                if not w3.is_connected():
                    continue
                _ = w3.eth.chain_id
                self._w3 = w3
                self._active_rpc = rpc
                self._rpc_index = idx
                return
            except Exception as exc:
                logger.warning("Mantle RPC unavailable %s: %s", rpc, exc)
        raise RuntimeError("No Mantle RPC endpoint reachable")

    def _should_failover(self, exc: Exception) -> bool:
        if isinstance(exc, (ConnectionError, TimeoutError, OSError)):
            return True
        msg = str(exc).lower()
        return any(
            token in msg
            for token in (
                "timeout",
                "connection",
                "503",
                "ssl",
                "certificate",
                "certifi",
                "self-signed",
            )
        )

    def _failover(self) -> None:
        next_index = (self._rpc_index + 1) % len(self._rpcs)
        logger.warning("Mantle RPC failover %s -> %s", self._active_rpc, self._rpcs[next_index])
        self._connect(next_index)

    def _call_with_failover(self, fn: Callable[[], T], *, label: str) -> T:
        last_exc: Exception | None = None
        for _ in range(len(self._rpcs)):
            try:
                return fn()
            except Exception as exc:
                last_exc = exc
                if self._should_failover(exc):
                    self._failover()
                    continue
                raise
        raise RuntimeError(f"Mantle RPC failed for {label}: {last_exc}")

    @property
    def w3(self) -> Web3:
        assert self._w3 is not None
        return self._w3

    @property
    def active_rpc(self) -> str:
        return self._active_rpc

    def get_gas_price(self) -> int:
        try:
            return int(self._call_with_failover(lambda: self.w3.eth.gas_price, label="gas_price"))
        except Exception as exc:
            logger.error("Failed to fetch gas price: %s", exc)
            return 0

    def get_balances(self, address: str, tokens: List[str]) -> Tuple[Dict[str, float], float]:
        """
        Fetches balances using Decimal math internally; returns API-safe floats.
        """
        checksum_address = self.w3.to_checksum_address(address)
        balances_decimal: Dict[str, Decimal] = {}

        token_set = {token.upper() for token in tokens}
        total_requested = len(token_set)
        successful_reads = 0

        if "MNT" in token_set:
            try:
                raw_bal = self._call_with_failover(
                    lambda: self.w3.eth.get_balance(checksum_address),
                    label="native_balance",
                )
                balances_decimal["MNT"] = _wei_to_decimal(int(raw_bal), 18)
                successful_reads += 1
            except Exception as exc:
                logger.warning("Failed to fetch native MNT balance: %s", exc)

        for token in token_set:
            if token == "MNT":
                continue

            token_addr = None
            if token == "USDC":
                token_addr = self._settings.mantle_usdc_address
            elif token in ("WMNT", "WETH", "ETH"):
                if token == "WMNT":
                    token_addr = self._settings.mantle_wmnt_address
                else:
                    token_addr = self._settings.mantle_weth_address

            if token_addr:
                val = self._get_erc20_balance_safe(checksum_address, token_addr)
                if val is not None:
                    balances_decimal[token] = val
                    successful_reads += 1
                else:
                    logger.warning(
                        "Observation degraded: Failed to read %s at %s", token, token_addr
                    )
            else:
                logger.debug("Skipping %s: No address configured.", token)

        balances = {symbol: _decimal_to_api(amount) for symbol, amount in balances_decimal.items()}
        quality = successful_reads / total_requested if total_requested > 0 else 1.0
        return balances, quality

    def _get_erc20_balance_safe(self, owner: str, token_address: str) -> Optional[Decimal]:
        """Defensively fetch ERC20 balance with metadata validation."""
        try:
            if not token_address or not Web3.is_address(token_address):
                return None

            checksum_token = self.w3.to_checksum_address(token_address)
            contract = self.w3.eth.contract(address=checksum_token, abi=_ERC20_ABI)

            try:
                _ = self._call_with_failover(
                    lambda: contract.functions.symbol().call(),
                    label="erc20_symbol",
                )
                decimals = int(
                    self._call_with_failover(
                        lambda: contract.functions.decimals().call(),
                        label="erc20_decimals",
                    )
                )
            except Exception as exc:
                logger.warning("Token at %s failed metadata validation: %s", token_address, exc)
                return None

            try:
                raw_balance = int(
                    self._call_with_failover(
                        lambda: contract.functions.balanceOf(owner).call(),
                        label="erc20_balance",
                    )
                )
                return _wei_to_decimal(raw_balance, decimals)
            except Exception as exc:
                logger.warning("Token at %s balance read failed: %s", token_address, exc)
                return None

        except Exception as exc:
            logger.error("Unexpected error reading token %s: %s", token_address, exc)
            return None
