from __future__ import annotations

from typing import Dict, List, Optional, Tuple
import logging

from web3 import Web3

from ..settings import Settings

logger = logging.getLogger(__name__)

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


def _rpc_candidates(settings: Settings) -> List[str]:
    urls = [settings.mantle_rpc_url]
    if settings.mantle_rpc_url_fallback:
        urls.append(settings.mantle_rpc_url_fallback)
    urls.extend(
        [
            "https://rpc.ankr.com/mantle_sepolia",
            "https://mantle-sepolia.drpc.org",
            "https://rpc.sepolia.mantle.xyz",
        ]
    )
    seen: set[str] = set()
    ordered: List[str] = []
    for url in urls:
        if url and url not in seen:
            seen.add(url)
            ordered.append(url)
    return ordered


class MantleClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._w3: Web3 | None = None
        self._active_rpc = ""
        for rpc in _rpc_candidates(settings):
            w3 = Web3(Web3.HTTPProvider(rpc, request_kwargs={"timeout": 10}))
            try:
                if not w3.is_connected():
                    continue
                # is_connected() alone is not enough — some endpoints reject eth_calls.
                _ = w3.eth.chain_id
                self._w3 = w3
                self._active_rpc = rpc
                break
            except Exception as exc:
                logger.warning("Mantle RPC unavailable %s: %s", rpc, exc)
        if self._w3 is None:
            raise RuntimeError("No Mantle RPC endpoint reachable")

    @property
    def w3(self) -> Web3:
        assert self._w3 is not None
        return self._w3

    @property
    def active_rpc(self) -> str:
        return self._active_rpc

    def get_gas_price(self) -> int:
        try:
            return int(self.w3.eth.gas_price)
        except Exception as e:
            logger.error(f"Failed to fetch gas price: {e}")
            return 0

    def get_balances(self, address: str, tokens: List[str]) -> Tuple[Dict[str, float], float]:
        """
        Fetches balances for a list of tokens.
        Returns a tuple of (balances_dict, observation_quality).
        """
        checksum_address = self.w3.to_checksum_address(address)
        balances: Dict[str, float] = {}

        token_set = {token.upper() for token in tokens}
        total_requested = len(token_set)
        successful_reads = 0

        if "MNT" in token_set:
            try:
                raw_bal = self.w3.eth.get_balance(checksum_address)
                balances["MNT"] = float(self.w3.from_wei(raw_bal, "ether"))
                successful_reads += 1
            except Exception as e:
                logger.warning(f"Failed to fetch native MNT balance: {e}")

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
                    balances[token] = val
                    successful_reads += 1
                else:
                    logger.warning(f"Observation degraded: Failed to read {token} at {token_addr}")
            else:
                logger.debug(f"Skipping {token}: No address configured.")

        quality = successful_reads / total_requested if total_requested > 0 else 1.0
        return balances, quality

    def _get_erc20_balance_safe(self, owner: str, token_address: str) -> Optional[float]:
        """Defensively fetch ERC20 balance with metadata validation."""
        try:
            if not token_address or not Web3.is_address(token_address):
                return None

            checksum_token = self.w3.to_checksum_address(token_address)
            contract = self.w3.eth.contract(address=checksum_token, abi=_ERC20_ABI)

            try:
                _ = contract.functions.symbol().call()
                decimals = contract.functions.decimals().call()
            except Exception as e:
                logger.warning(f"Token at {token_address} failed metadata validation: {e}")
                return None

            try:
                raw_balance = contract.functions.balanceOf(owner).call()
                return float(raw_balance) / float(10**decimals)
            except Exception as e:
                logger.warning(f"Token at {token_address} balance read failed: {e}")
                return None

        except Exception as exc:
            logger.error(f"Unexpected error reading token {token_address}: {exc}")
            return None
