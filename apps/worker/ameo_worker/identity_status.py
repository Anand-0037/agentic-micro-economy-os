from __future__ import annotations

from typing import Any, Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .settings import Settings


def signing_eoa_from_settings(settings: "Settings") -> str:
    """Address that signs logDecision — derived from AGENT_PRIVATE_KEY when set."""
    key = (settings.agent_private_key or "").strip()
    if key:
        from eth_account import Account

        normalized = key if key.startswith("0x") else f"0x{key}"
        return Account.from_key(normalized).address
    return (settings.agent_eoa or "").strip()


def effective_max_daily_volume_usd(settings: "Settings") -> float:
    raw = settings.max_daily_volume_usd
    return raw if raw > 0 else 500.0


def inspect_identity_readiness(
    settings: "Settings",
    *,
    w3: Any = None,
    contract: Any = None,
) -> Dict[str, Any]:
    """Check whether the signing EOA owns AGENT_TOKEN_ID (required for DecisionLogged)."""
    signing = signing_eoa_from_settings(settings)
    token_id = settings.agent_token_id
    identity = (settings.agent_identity_address or "").strip()

    result: Dict[str, Any] = {
        "signing_eoa": signing,
        "agent_eoa_configured": (settings.agent_eoa or "").strip(),
        "agent_token_id": token_id,
        "identity_contract": identity,
        "nft_minted": False,
        "nft_owner": None,
        "ready": False,
        "action_required": None,
    }

    if not signing:
        result["action_required"] = "Set AGENT_PRIVATE_KEY (or AGENT_EOA for read-only checks)."
        return result
    if not identity:
        result["action_required"] = "Set AGENT_IDENTITY_ADDRESS."
        return result

    configured = (settings.agent_eoa or "").strip()
    if configured and configured.lower() != signing.lower():
        result["agent_eoa_mismatch"] = True
        result["action_required"] = (
            f"AGENT_EOA ({configured}) does not match signing address ({signing}). "
            "Update AGENT_EOA/VITE_AGENT_EOA to the AGENT_PRIVATE_KEY address."
        )

    if w3 is None or contract is None:
        return result

    try:
        owner = contract.functions.ownerOf(token_id).call()
        result["nft_owner"] = owner
        result["nft_minted"] = True
        if owner.lower() == signing.lower():
            result["ready"] = True
        else:
            result["action_required"] = (
                f"mintAgent({signing}) on {identity} — token {token_id} is owned by {owner}."
            )
    except Exception:
        result["action_required"] = (
            f"mintAgent({signing}) on {identity} for tokenId={token_id} "
            "(run scripts/bootstrap-agent.py with deployer key once, then remove IDENTITY_OWNER_PRIVATE_KEY)."
        )

    return result
