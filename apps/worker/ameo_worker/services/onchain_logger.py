from __future__ import annotations

import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)

from ..clients.mantle import MantleClient
from ..settings import Settings

_AGENT_IDENTITY_ABI = [
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "agentId", "type": "uint256"},
            {"indexed": False, "name": "rationaleHash", "type": "bytes32"},
            {"indexed": False, "name": "signedPnL1e18", "type": "int256"},
            {"indexed": False, "name": "actionType", "type": "string"},
            {"indexed": False, "name": "metadataUri", "type": "string"},
            {"indexed": False, "name": "dataHash", "type": "string"},
            {"indexed": False, "name": "operator", "type": "address"},
        ],
        "name": "DecisionLogged",
        "type": "event",
    },
    {
        "inputs": [{"name": "operator", "type": "address"}],
        "name": "mintAgent",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "nextTokenId",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "name": "ownerOf",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    # Full V2 signature (matches updated MantleAgentIdentity.sol with PnL, dataHash, total aggregation + capability)
    # Note: the on-chain deployed contract (see broadcast) may be an older version until redeployed.
    {
        "inputs": [
            {"name": "agentId", "type": "uint256"},
            {"name": "rationaleHash", "type": "bytes32"},
            {"name": "signedPnL1e18", "type": "int256"},
            {"name": "actionType", "type": "string"},
            {"name": "metadataUri", "type": "string"},
            {"name": "dataHash", "type": "string"},
        ],
        "name": "logDecision",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"name": "agentId", "type": "uint256"}],
        "name": "getAgentProfile",
        "outputs": [
            {"name": "lastRationale", "type": "bytes32"},
            {"name": "lastPnL", "type": "int256"},
            {"name": "totalPnL", "type": "int256"},
            {"name": "decisions", "type": "uint256"},
            {"name": "lastMeta", "type": "string"},
            {"name": "capability", "type": "string"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "agentId", "type": "uint256"},
            {"name": "capability", "type": "string"}
        ],
        "name": "registerCapability",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "name": "tokenURI",
        "outputs": [{"name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    }
]


class OnchainLogger:
    def __init__(self, settings: Settings) -> None:
        if not settings.agent_identity_address:
            raise RuntimeError("AGENT_IDENTITY_ADDRESS is required")

        signing_key = settings.agent_private_key
        if not signing_key:
            raise RuntimeError("AGENT_PRIVATE_KEY is required for on-chain logging")

        self._settings = settings
        self._signing_key = (
            signing_key if signing_key.startswith("0x") else f"0x{signing_key}"
        )
        self._mantle = MantleClient(settings)
        self._w3 = self._mantle.w3
        self._contract = self._w3.eth.contract(
            address=self._w3.to_checksum_address(settings.agent_identity_address),
            abi=_AGENT_IDENTITY_ABI,
        )

    def log_decision(
        self,
        agent_id: int,
        rationale: str,
        pnl1e18: int,
        action_type: str,
        metadata_uri: str,
        data_hash: str,
    ) -> Dict[str, Any]:
        account = self._w3.eth.account.from_key(self._signing_key)
        agent_id = self._ensure_agent_minted(agent_id, account.address)
        rationale_hash = self._w3.keccak(text=rationale)

        # Use full V2 logDecision (PnL + dataHash + onchain aggregation in updated contract).
        # If calling against old deployed V1 contract this will fail on selector; redeploy identity for full ERC-8004 profile.
        tx = self._contract.functions.logDecision(
            agent_id,
            rationale_hash,
            pnl1e18,
            action_type,
            metadata_uri,
            data_hash,
        ).build_transaction(
            {
                "from": account.address,
                "nonce": self._w3.eth.get_transaction_count(account.address, "pending"),
                "chainId": self._settings.mantle_chain_id,
                "gasPrice": self._w3.eth.gas_price,
            }
        )

        gas_estimate = self._w3.eth.estimate_gas(tx)
        tx["gas"] = int(gas_estimate * 1.2)

        signed = self._w3.eth.account.sign_transaction(tx, self._signing_key)
        tx_hash = self._w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self._w3.eth.wait_for_transaction_receipt(tx_hash)

        if receipt.status == 1:
            try:
                if action_type in ("bundle", "lp_add", "perps_open"):
                    capability = "delta-neutral-lp-hedge"
                else:
                    capability = "policy-enforced-autonomous-finance-agent"

                cap_tx = self._contract.functions.registerCapability(
                    agent_id,
                    capability,
                ).build_transaction(
                    {
                        "from": account.address,
                        "nonce": self._w3.eth.get_transaction_count(account.address, "pending"),
                        "chainId": self._settings.mantle_chain_id,
                        "gasPrice": self._w3.eth.gas_price,
                    }
                )
                cap_tx["gas"] = int(self._w3.eth.estimate_gas(cap_tx) * 1.2)
                signed_cap = self._w3.eth.account.sign_transaction(cap_tx, self._signing_key)
                cap_hash = self._w3.eth.send_raw_transaction(signed_cap.raw_transaction)
                self._w3.eth.wait_for_transaction_receipt(cap_hash)
                logger.info("Capability '%s' registered for agent %s in tx %s", capability, agent_id, cap_hash.hex())
            except Exception as exc:
                logger.warning("Failed to automatically register capability for agent %s: %s", agent_id, exc)

        return {
            "tx_hash": tx_hash.hex(),
            "status": receipt.status,
            "agent_token_id": agent_id,
        }

    def _ensure_agent_minted(self, agent_id: int, operator: str) -> int:
        """Mint the agent NFT on first use when tokenId is not yet issued."""
        try:
            owner = self._contract.functions.ownerOf(agent_id).call()
            if owner.lower() == operator.lower():
                return agent_id
        except Exception:
            pass

        next_id = int(self._contract.functions.nextTokenId().call())
        if next_id != agent_id:
            raise RuntimeError(
                f"AGENT_TOKEN_ID={agent_id} is not minted and nextTokenId={next_id}"
            )

        mint_tx = self._contract.functions.mintAgent(
            self._w3.to_checksum_address(operator)
        ).build_transaction(
            {
                "from": operator,
                "nonce": self._w3.eth.get_transaction_count(operator, "pending"),
                "chainId": self._settings.mantle_chain_id,
                "gasPrice": self._w3.eth.gas_price,
            }
        )
        mint_tx["gas"] = int(self._w3.eth.estimate_gas(mint_tx) * 1.2)
        signed = self._w3.eth.account.sign_transaction(mint_tx, self._signing_key)
        mint_hash = self._w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self._w3.eth.wait_for_transaction_receipt(mint_hash)
        if receipt.status != 1:
            raise RuntimeError(f"mintAgent reverted: {mint_hash.hex()}")
        return agent_id
