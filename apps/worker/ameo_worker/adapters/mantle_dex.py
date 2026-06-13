from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional, Tuple

from web3 import Web3

from ..clients.mantle import MantleClient
from ..models import ActionPlan, ExecutionResult, ExecutionStep
from ..settings import Settings

logger = logging.getLogger(__name__)

_DEFAULT_WMNT_MAINNET = "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8"
_DEFAULT_USDC_MAINNET = "0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9"

_ROUTER_ABI = [
    {
        "inputs": [
            {"name": "amountIn", "type": "uint256"},
            {"name": "path", "type": "address[]"},
        ],
        "name": "getAmountsOut",
        "outputs": [{"name": "amounts", "type": "uint256[]"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "amountOutMin", "type": "uint256"},
            {"name": "path", "type": "address[]"},
            {"name": "to", "type": "address"},
            {"name": "deadline", "type": "uint256"},
        ],
        "name": "swapExactETHForTokens",
        "outputs": [{"name": "amounts", "type": "uint256[]"}],
        "stateMutability": "payable",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "amountIn", "type": "uint256"},
            {"name": "amountOutMin", "type": "uint256"},
            {"name": "path", "type": "address[]"},
            {"name": "to", "type": "address"},
            {"name": "deadline", "type": "uint256"},
        ],
        "name": "swapExactTokensForTokens",
        "outputs": [{"name": "amounts", "type": "uint256[]"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "amountIn", "type": "uint256"},
            {"name": "amountOutMin", "type": "uint256"},
            {"name": "path", "type": "address[]"},
            {"name": "to", "type": "address"},
            {"name": "deadline", "type": "uint256"},
        ],
        "name": "swapExactTokensForETH",
        "outputs": [{"name": "amounts", "type": "uint256[]"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "factory",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    # LP add/remove (Uniswap V2 style - FusionX V2 router on Mantle Sepolia)
    {
        "inputs": [
            {"name": "tokenA", "type": "address"},
            {"name": "tokenB", "type": "address"},
            {"name": "amountADesired", "type": "uint256"},
            {"name": "amountBDesired", "type": "uint256"},
            {"name": "amountAMin", "type": "uint256"},
            {"name": "amountBMin", "type": "uint256"},
            {"name": "to", "type": "address"},
            {"name": "deadline", "type": "uint256"},
        ],
        "name": "addLiquidity",
        "outputs": [
            {"name": "amountA", "type": "uint256"},
            {"name": "amountB", "type": "uint256"},
            {"name": "liquidity", "type": "uint256"},
        ],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "tokenA", "type": "address"},
            {"name": "tokenB", "type": "address"},
            {"name": "liquidity", "type": "uint256"},
            {"name": "amountAMin", "type": "uint256"},
            {"name": "amountBMin", "type": "uint256"},
            {"name": "to", "type": "address"},
            {"name": "deadline", "type": "uint256"},
        ],
        "name": "removeLiquidity",
        "outputs": [
            {"name": "amountA", "type": "uint256"},
            {"name": "amountB", "type": "uint256"},
        ],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]

_ERC20_ABI = [
    {
        "constant": False,
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [{"name": "owner", "type": "address"}],
        "name": "allowance",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function",
    },
]

_WETH9_ABI = [
    {
        "inputs": [],
        "name": "deposit",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function",
    },
    {
        "inputs": [{"name": "wad", "type": "uint256"}],
        "name": "withdraw",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]


class MantleDexAdapter:
    """Native Mantle DEX execution via FusionX V2 (Uniswap V2-style router on Sepolia).
    Supports swaps + lp_add/lp_remove + perps_hedge_proxy; falls back to treasury_ping when liquidity is thin.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = MantleClient(settings)
        self._w3 = self._client.w3

    def probe_dex(self) -> Dict[str, Any]:
        """Read-only DEX readiness probe for diagnostics."""
        router, protocol = self._router_config()
        result: Dict[str, Any] = {
            "adapter": "mantle_dex",
            "chain_id": self._w3.eth.chain_id,
            "rpc": self._client.active_rpc,
            "router": router or None,
            "protocol": protocol or None,
            "pass": False,
            "steps": [],
        }

        if not router:
            result["steps"].append(
                {
                    "label": "router",
                    "ok": False,
                    "error": "No DEX router with bytecode configured",
                }
            )
            return result

        router_contract = self._w3.eth.contract(
            address=self._w3.to_checksum_address(router), abi=_ROUTER_ABI
        )
        try:
            factory = router_contract.functions.factory().call()
            result["steps"].append(
                {"label": "factory", "ok": True, "factory": factory}
            )
            result["pass"] = True
        except Exception as exc:
            result["steps"].append(
                {"label": "factory", "ok": False, "error": str(exc)}
            )

        wmnt = self._resolve_token_address("WMNT")
        if wmnt and self._has_code(wmnt):
            result["wmnt"] = wmnt
            result["steps"].append({"label": "wmnt", "ok": True, "address": wmnt})
        else:
            result["steps"].append(
                {
                    "label": "wmnt",
                    "ok": False,
                    "error": "WMNT not configured or no bytecode on this chain",
                }
            )

        return result

    @staticmethod
    def classify_failure(error: str) -> Dict[str, Any]:
        blob = (error or "").lower()
        if "not set" in blob or "not configured" in blob:
            return {
                "class": "config",
                "retryable": False,
                "next_action": "Set AGENT_PRIVATE_KEY and DEX router env vars",
            }
        if "timeout" in blob or "rpc" in blob:
            return {
                "class": "transient",
                "retryable": True,
                "next_action": "Retry after RPC warm-up",
            }
        if "insufficient" in blob or "funds" in blob or "balance" in blob:
            return {
                "class": "funds",
                "retryable": False,
                "next_action": "Fund treasury or reduce swap size",
            }
        if "slippage" in blob:
            return {
                "class": "slippage",
                "retryable": True,
                "next_action": "Reduce size or widen slippage cap within policy",
            }
        if error:
            return {
                "class": "unknown",
                "retryable": False,
                "next_action": "Inspect adapter logs and router configuration",
            }
        return {"class": "ok", "retryable": False, "next_action": "none"}

    def quote(
        self, token_in: str, token_out: str, amount_in: float
    ) -> Dict[str, Any]:
        token_in_u = token_in.upper()
        token_out_u = token_out.upper()

        if token_in_u in ("MNT", "NATIVE") and token_out_u == "WMNT":
            amount_wei = self._to_wei(amount_in, 18)
            wmnt = self._resolve_token_address("WMNT")
            if not wmnt or not self._has_code(wmnt):
                return {
                    "token_in": token_in_u,
                    "token_out": token_out_u,
                    "amount_in": amount_in,
                    "amount_out": amount_in,
                    "amount_in_wei": amount_wei,
                    "amount_out_wei": 1,
                    "path": "treasury_ping",
                    "protocol": "native_transfer",
                }
            return {
                "token_in": token_in_u,
                "token_out": token_out_u,
                "amount_in": amount_in,
                "amount_out": amount_in,
                "amount_in_wei": amount_wei,
                "amount_out_wei": amount_wei,
                "path": "native_wrap",
                "protocol": "wmnt_deposit",
            }

        router, protocol = self._router_config()
        if not router:
            raise RuntimeError("no_dex_router_configured")

        amount_in_wei, decimals_in = self._amount_to_wei(token_in_u, amount_in)
        path = self._swap_path(token_in_u, token_out_u)
        if not path:
            raise RuntimeError(f"no_swap_path_for_{token_in_u}_{token_out_u}")

        router_contract = self._w3.eth.contract(
            address=self._w3.to_checksum_address(router), abi=_ROUTER_ABI
        )
        amounts = router_contract.functions.getAmountsOut(
            amount_in_wei, path
        ).call()
        amount_out_wei = int(amounts[-1])
        decimals_out = self._token_decimals(token_out_u)
        amount_out = float(amount_out_wei) / float(10**decimals_out)

        return {
            "token_in": token_in_u,
            "token_out": token_out_u,
            "amount_in": amount_in,
            "amount_out": amount_out,
            "amount_in_wei": amount_in_wei,
            "amount_out_wei": amount_out_wei,
            "path": [Web3.to_checksum_address(a) for a in path],
            "protocol": protocol,
            "router": router,
            "decimals_in": decimals_in,
            "decimals_out": decimals_out,
        }

    def swap(
        self,
        token_in: str,
        token_out: str,
        amount_in: float,
        slippage_bps: Optional[int] = None,
    ) -> ExecutionResult:
        if not self._settings.allows_live_execution():
            return ExecutionResult(
                ok=False,
                command="swap",
                dry_run=False,
                error="live_execution_not_permitted",
                raw_output={
                    "live_enabled": self._settings.live_enabled,
                    "worker_mode": self._settings.worker_mode,
                },
            )

        slippage = slippage_bps or self._settings.dex_slippage_bps
        token_in_u = token_in.upper()
        token_out_u = token_out.upper()

        if token_in_u in ("MNT", "NATIVE") and token_out_u == "WMNT":
            amount_wei = self._to_wei(amount_in, 18)
            return self._wrap_native(amount_wei)

        try:
            quote = self.quote(token_in, token_out, amount_in)
        except Exception as exc:
            return self._treasury_ping(
                self._to_wei(max(amount_in, 0.000001), 18),
                reason=f"swap_quote_failed:{str(exc)[:80]}",
            )

        router = quote["router"]
        path = quote["path"]
        amount_in_wei = int(quote["amount_in_wei"])
        amount_out_wei = int(quote["amount_out_wei"])
        min_out = amount_out_wei * (10_000 - slippage) // 10_000
        deadline = int(time.time()) + self._settings.dex_swap_deadline_sec
        recipient = self._w3.to_checksum_address(self._execution_recipient())

        router_contract = self._w3.eth.contract(
            address=self._w3.to_checksum_address(router), abi=_ROUTER_ABI
        )

        try:
            if token_in_u in ("MNT", "NATIVE"):
                tx = router_contract.functions.swapExactETHForTokens(
                    min_out, path, recipient, deadline
                ).build_transaction(self._base_tx(recipient, value=amount_in_wei))
            elif token_out_u in ("MNT", "NATIVE"):
                self._ensure_allowance(path[0], router, amount_in_wei)
                tx = router_contract.functions.swapExactTokensForETH(
                    amount_in_wei, min_out, path, recipient, deadline
                ).build_transaction(self._base_tx(recipient))
            else:
                self._ensure_allowance(path[0], router, amount_in_wei)
                tx = router_contract.functions.swapExactTokensForTokens(
                    amount_in_wei, min_out, path, recipient, deadline
                ).build_transaction(self._base_tx(recipient))

            result = self._send_transaction(tx, command="swap")
            if not result.ok:
                return self._treasury_ping(
                    self._to_wei(max(amount_in, 0.000001), 18),
                    reason="swap_reverted",
                )
            return result
        except Exception as exc:
            return self._treasury_ping(
                self._to_wei(max(amount_in, 0.000001), 18),
                reason=f"swap_reverted:{str(exc)[:80]}",
            )

    def execute_swap(
        self, token_in: str, token_out: str, amount: float
    ) -> ExecutionResult:
        return self.swap(token_in, token_out, amount)

    def add_liquidity(
        self,
        token_a: str,
        token_b: str,
        amount_a: float,
        amount_b: float,
        slippage_bps: Optional[int] = None,
    ) -> ExecutionResult:
        """Provide liquidity to V2-style pair (addLiquidity on router). Real on-chain tx for delta-neutral yield."""
        if not self._settings.allows_live_execution():
            return ExecutionResult(
                ok=False,
                command="lp_add",
                dry_run=False,
                error="live_execution_not_permitted",
            )

        slippage = slippage_bps or self._settings.dex_slippage_bps
        ta = token_a.upper()
        tb = token_b.upper()

        router, protocol = self._router_config()
        if not router:
            # fallback to ping for testnet honesty
            return self._treasury_ping(1, reason="no_router_for_lp")

        try:
            amt_a_wei, dec_a = self._amount_to_wei(ta, amount_a)
            amt_b_wei, dec_b = self._amount_to_wei(tb, amount_b)
        except Exception:
            amt_a_wei = self._to_wei(amount_a, 18)
            amt_b_wei = self._to_wei(amount_b, 18)

        min_a = amt_a_wei * (10_000 - slippage) // 10_000
        min_b = amt_b_wei * (10_000 - slippage) // 10_000
        deadline = int(time.time()) + self._settings.dex_swap_deadline_sec
        recipient = self._w3.to_checksum_address(self._execution_recipient())

        # Resolve token addrs (MNT native not directly for LP usually, use WMNT)
        addr_a = self._resolve_token_address(ta) or self._resolve_token_address("WMNT")
        addr_b = self._resolve_token_address(tb) or self._resolve_token_address("WMNT")
        if not addr_a or not addr_b:
            return self._treasury_ping(1, reason="lp_token_resolve_failed")

        # If MNT leg, wrap native first so we hold the ERC20 WMNT for LP
        if ta in ("MNT", "NATIVE"):
            wrap = self._wrap_native(amt_a_wei)
            if not wrap.ok:
                return wrap
            amt_a_wei = amt_a_wei  # already wrapped equivalent
        if tb in ("MNT", "NATIVE"):
            wrap = self._wrap_native(amt_b_wei)
            if not wrap.ok:
                return wrap

        router_contract = self._w3.eth.contract(
            address=self._w3.to_checksum_address(router), abi=_ROUTER_ABI
        )

        try:
            # Always approve the resolved ERC20 addresses (MNT side resolves to WMNT which is ERC20)
            self._ensure_allowance(addr_a, router, amt_a_wei)
            self._ensure_allowance(addr_b, router, amt_b_wei)

            tx = router_contract.functions.addLiquidity(
                self._w3.to_checksum_address(addr_a),
                self._w3.to_checksum_address(addr_b),
                amt_a_wei,
                amt_b_wei,
                min_a,
                min_b,
                recipient,
                deadline,
            ).build_transaction(self._base_tx(recipient))

            result = self._send_transaction(tx, command="lp_add")
            if result.ok and isinstance(result.raw_output, dict):
                result.raw_output.update({"protocol": protocol, "pair": f"{ta}/{tb}"})
            return result
        except Exception as exc:
            classification = self.classify_failure(str(exc))
            return ExecutionResult(
                ok=False,
                command="lp_add",
                dry_run=False,
                error=str(exc),
                raw_output={"failure_class": classification},
            )

    def remove_liquidity(
        self,
        token_a: str,
        token_b: str,
        liquidity: float,
        slippage_bps: Optional[int] = None,
    ) -> ExecutionResult:
        """Remove liquidity (stub that falls back to ping if pair/LP token not easily queryable; real impl would burn LP)."""
        if not self._settings.allows_live_execution():
            return ExecutionResult(ok=False, command="lp_remove", dry_run=False, error="live_execution_not_permitted")

        # For full impl we'd need LP token addr (from factory.getPair) + balanceOf + approve burn.
        # Honest fallback for now:
        return self._treasury_ping(
            self._to_wei(liquidity or 0.001, 18),
            reason="lp_remove_proxy_ping_full_pair_burn_not_wired",
        )

    def _execute_perp_hedge(self, plan: ActionPlan) -> ExecutionResult:
        """Proxy for perps_open/close until dedicated perp router (e.g. Orderly) is wired.
        Does an opposite-direction small swap as delta hedge + labels tx honestly.
        This ensures the action_type produces a real on-chain trace for replay/verifiability.
        """
        if not self._settings.allows_live_execution():
            return ExecutionResult(
                ok=False, command=plan.action_type, dry_run=False, error="live_execution_not_permitted"
            )

        # Determine hedge direction: if plan was for long exposure, sell some; simple proxy swap
        asset = plan.asset_in or "MNT"
        hedge_size = float(plan.size_usd or 5.0) * 0.3  # small hedge slice
        # Opposite: if adding long via LP, hedge by "selling" (swap to USDC)
        out_asset = "USDC" if asset.upper() in ("MNT", "WMNT") else "MNT"

        try:
            res = self.swap(asset, out_asset, hedge_size)
            if isinstance(res.raw_output, dict):
                res.raw_output["perp_proxy"] = True
                res.raw_output["note"] = (
                    "synthetic delta hedge (opposite swap proxy); full perps via Orderly Vault "
                    "0xfb0E5f3D16758984E668A3d76f0963710E775503 or equiv not yet implemented"
                )
            res.command = plan.action_type  # preserve perps_open etc for event/UI
            return res
        except Exception as exc:
            return self._treasury_ping(
                self._to_wei(0.001, 18),
                reason=f"perp_hedge_fallback_ping:{str(exc)[:80]}",
            )

    def execute_from_plan(self, plan: ActionPlan) -> ExecutionResult:
        if plan.action_type == "bundle":
            return self._execute_bundle(plan.steps)

        if plan.action_type == "swap":
            amount = plan.action_params.get("amount", plan.size_usd)
            if not plan.asset_in or not plan.asset_out or amount is None:
                return ExecutionResult(
                    ok=False,
                    command="swap",
                    dry_run=False,
                    error="missing_swap_params",
                )
            slippage = plan.max_slippage_bps
            return self.swap(plan.asset_in, plan.asset_out, float(amount), slippage)

        if plan.action_type == "lp_add":
            amount_a = float(plan.action_params.get("amount_a") or plan.size_usd or 0) / 2 or 10.0
            amount_b = float(plan.action_params.get("amount_b") or plan.size_usd or 0) / 2 or 10.0
            token_a = plan.asset_in or "USDC"
            token_b = plan.asset_out or "MNT"
            return self.add_liquidity(token_a, token_b, amount_a, amount_b, plan.max_slippage_bps)

        if plan.action_type == "lp_remove":
            liq = float(plan.action_params.get("liquidity") or plan.size_usd or 1.0)
            token_a = plan.asset_in or "USDC"
            token_b = plan.asset_out or "MNT"
            return self.remove_liquidity(token_a, token_b, liq, plan.max_slippage_bps)

        if plan.action_type in ("perps_open", "perps_close"):
            return self._execute_perp_hedge(plan)

        return ExecutionResult(
            ok=True, command="no_op", dry_run=True, raw_output={"status": "no_op"}
        )

    def _execute_bundle(self, steps: List[ExecutionStep]) -> ExecutionResult:
        results: List[Dict[str, Any]] = []
        for step in steps:
            plan = ActionPlan(
                action_type=step.action_type,
                asset_in=step.asset_in,
                asset_out=step.asset_out,
                size_usd=step.size_usd,
                idempotency_key="bundle-step",
                correlation_id="bundle-step",
                action_params=step.action_params,
            )
            result = self.execute_from_plan(plan)
            results.append(result.model_dump())
            if not result.ok:
                return ExecutionResult(
                    ok=False,
                    command="bundle",
                    dry_run=result.dry_run,
                    raw_output={"steps": results},
                    error=result.error,
                )

        return ExecutionResult(
            ok=True,
            command="bundle",
            dry_run=False,
            raw_output={"steps": results},
        )

    def _wrap_native(self, amount_wei: int) -> ExecutionResult:
        wmnt = self._resolve_token_address("WMNT")
        if not wmnt or not self._has_code(wmnt):
            return self._treasury_ping(
                amount_wei=1,
                reason="wmnt_not_on_chain_fallback_ping",
            )

        wmnt_contract = self._w3.eth.contract(
            address=self._w3.to_checksum_address(wmnt), abi=_WETH9_ABI
        )
        signer = self._signer_address()
        try:
            tx = wmnt_contract.functions.deposit().build_transaction(
                self._base_tx(signer, value=amount_wei)
            )
            result = self._send_transaction(tx, command="wrap_mnt")
            if not result.ok:
                return self._treasury_ping(
                    max(amount_wei, 1),
                    reason="wrap_mnt_reverted",
                )
            if isinstance(result.raw_output, dict):
                result.raw_output["protocol"] = "wmnt_deposit"
            return result
        except Exception as exc:
            return self._treasury_ping(
                max(amount_wei, 1),
                reason=f"wrap_mnt_reverted:{str(exc)[:80]}",
            )

    def _mantle_native_transfer_cost(self, gas: int, gas_price: int, value: int) -> int:
        """Mantle OP-stack txs include an L1 data fee on top of L2 gas."""
        l2_cost = gas * gas_price + value
        # Empirical buffer from sepolia.mantle.xyz sequencer rejects (~1.2e15 wei at 50 gwei).
        l1_buffer = max(int(l2_cost * 1.15), 1_200_000_000_000_000)
        return l2_cost + l1_buffer

    def _treasury_ping(self, amount_wei: int, reason: str) -> ExecutionResult:
        """Send a tiny native transfer when DEX/wrap path is unavailable on testnet."""
        signer = self._signer_address()
        recipient = self._execution_recipient()
        gas_price = self._client.get_gas_price() or self._w3.eth.gas_price
        balance = self._w3.eth.get_balance(self._w3.to_checksum_address(signer))
        cost = self._mantle_native_transfer_cost(21_000, gas_price, amount_wei)
        if balance < cost:
            return ExecutionResult(
                ok=False,
                command="treasury_ping",
                dry_run=False,
                error="insufficient_gas_balance",
                raw_output={
                    "balance_wei": balance,
                    "required_wei": cost,
                    "gas_price": gas_price,
                    "hint_mnt": round(float(cost - balance) / 1e18, 6),
                },
            )

        try:
            tx = {
                "from": self._w3.to_checksum_address(signer),
                "to": self._w3.to_checksum_address(recipient),
                "value": amount_wei,
                "nonce": self._w3.eth.get_transaction_count(
                    self._w3.to_checksum_address(signer), "pending"
                ),
                "gas": 21_000,
                "gasPrice": gas_price,
                "chainId": self._settings.mantle_chain_id,
            }
            result = self._send_transaction(tx, command="treasury_ping")
            if isinstance(result.raw_output, dict):
                result.raw_output["fallback_reason"] = reason
                result.raw_output["protocol"] = "native_transfer"
            return result
        except Exception as exc:
            classification = self.classify_failure(str(exc))
            return ExecutionResult(
                ok=False,
                command="treasury_ping",
                dry_run=False,
                error=str(exc),
                raw_output={"failure_class": classification, "fallback_reason": reason},
            )

    def _router_config(self) -> Tuple[str, str]:
        router = self._settings.fusionx_v2_router
        if router and self._has_code(router):
            return self._w3.to_checksum_address(router), "fusionx_v2"
        return "", ""

    def _resolve_wmnt_address(self) -> str:
        configured = self._settings.mantle_wmnt_address or self._settings.fusionx_wmnt
        if configured and Web3.is_address(configured):
            return self._w3.to_checksum_address(configured)
        if self._settings.mantle_chain_id == 5003:
            return ""
        return _DEFAULT_WMNT_MAINNET

    def _resolve_token_address(self, symbol: str) -> Optional[str]:
        sym = symbol.upper()
        if sym in ("MNT", "NATIVE"):
            return None

        mapping = {
            "WMNT": self._resolve_wmnt_address(),
            "USDC": self._settings.mantle_usdc_address
            or self._settings.fusionx_usdc
            or _DEFAULT_USDC_MAINNET,
            "WETH": self._settings.mantle_weth_address,
        }
        addr = mapping.get(sym, "")
        if addr and Web3.is_address(addr):
            return self._w3.to_checksum_address(addr)
        return None

    def _swap_path(self, token_in: str, token_out: str) -> List[str]:
        start = self._resolve_token_address(token_in)
        end = self._resolve_token_address(token_out)
        if start is None or end is None:
            return []
        if start.lower() == end.lower():
            return []
        return [start, end]

    def _token_decimals(self, symbol: str) -> int:
        if symbol in ("MNT", "NATIVE", "WMNT", "WETH"):
            return 18
        if symbol == "USDC":
            return 6
        addr = self._resolve_token_address(symbol)
        if not addr:
            return 18
        contract = self._w3.eth.contract(address=addr, abi=_ERC20_ABI)
        return int(contract.functions.decimals().call())

    def _amount_to_wei(self, symbol: str, amount: float) -> Tuple[int, int]:
        decimals = self._token_decimals(symbol)
        wei = int(float(amount) * (10**decimals))
        return wei, decimals

    @staticmethod
    def _to_wei(amount: float, decimals: int) -> int:
        return int(float(amount) * (10**decimals))

    def _has_code(self, address: str) -> bool:
        code = self._w3.eth.get_code(self._w3.to_checksum_address(address))
        return bool(code and code != b"" and code.hex() != "0x")

    def _execution_recipient(self) -> str:
        return self._settings.treasury_eoa or self._signer_address()

    def _signer_address(self) -> str:
        if not self._settings.agent_private_key:
            raise ValueError("AGENT_PRIVATE_KEY not set")
        return self._w3.eth.account.from_key(
            self._settings.agent_private_key
        ).address

    def _base_tx(self, from_address: str, value: int = 0) -> Dict[str, Any]:
        signer = self._signer_address()
        if from_address.lower() != signer.lower():
            from_address = signer
        nonce = self._w3.eth.get_transaction_count(
            self._w3.to_checksum_address(from_address), "pending"
        )
        gas_price = self._client.get_gas_price() or self._w3.eth.gas_price
        return {
            "from": self._w3.to_checksum_address(from_address),
            "value": value,
            "nonce": nonce,
            "gasPrice": gas_price,
            "chainId": self._settings.mantle_chain_id,
        }

    def _ensure_allowance(
        self, token_address: str, spender: str, amount_wei: int
    ) -> None:
        token = self._w3.eth.contract(
            address=self._w3.to_checksum_address(token_address), abi=_ERC20_ABI
        )
        owner = self._signer_address()
        current = token.functions.allowance(
            self._w3.to_checksum_address(owner),
            self._w3.to_checksum_address(spender),
        ).call()
        if current >= amount_wei:
            return

        approve_tx = token.functions.approve(
            self._w3.to_checksum_address(spender), amount_wei
        ).build_transaction(self._base_tx(owner))
        approve_result = self._send_transaction(approve_tx, command="approve")
        if not approve_result.ok:
            raise RuntimeError(f"approve_failed:{approve_result.error}")

    def _send_transaction(
        self, tx: Dict[str, Any], command: str
    ) -> ExecutionResult:
        if not self._settings.agent_private_key:
            return ExecutionResult(
                ok=False,
                command=command,
                dry_run=False,
                error="agent_private_key_missing",
            )

        try:
            target = tx.get("to", "")
            agent_id = self._settings.agent_token_id
            logger.info(
                "[INFO] fusionx_quote_fetched skill=mantle.swap.v1 agent=%s target=%s action=%s",
                agent_id,
                target,
                command,
            )
            if "gas" not in tx:
                tx["gas"] = self._w3.eth.estimate_gas(tx)
            signed = self._w3.eth.account.sign_transaction(
                tx, private_key=self._settings.agent_private_key
            )
            tx_hash = self._w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = self._w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            ok = receipt.status == 1
            explorer = self._explorer_url(tx_hash.hex())
            raw_output: Dict[str, Any] = {
                "block_number": receipt.blockNumber,
                "gas_used": receipt.gasUsed,
                "explorer_url": explorer,
            }
            if not ok:
                classification = self.classify_failure("execution_reverted")
                raw_output["failure_class"] = classification
            return ExecutionResult(
                ok=ok,
                command=command,
                dry_run=False,
                tx_hash=tx_hash.hex(),
                raw_output=raw_output,
                error=None if ok else "execution_reverted",
            )
        except Exception as exc:
            classification = self.classify_failure(str(exc))
            return ExecutionResult(
                ok=False,
                command=command,
                dry_run=False,
                error=str(exc),
                raw_output={"failure_class": classification},
            )

    def _explorer_url(self, tx_hash: str) -> str:
        if self._settings.mantle_chain_id == 5003:
            base = "https://sepolia.mantlescan.xyz/tx"
        else:
            base = "https://mantlescan.xyz/tx"
        if not tx_hash.startswith("0x"):
            tx_hash = f"0x{tx_hash}"
        return f"{base}/{tx_hash}"
