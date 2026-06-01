import os
import pytest
import httpx

WORKER_URL = os.getenv("VERIFY_SMOKE_WORKER_URL", "http://localhost:8000")

@pytest.mark.smoke
def test_latest_tx_verifies_clean():
    """Block B smoke: latest real cycle must verify cleanly (no tx_not_indexed)."""
    r = httpx.get(f"{WORKER_URL}/v1/decisions?limit=1", timeout=15)
    r.raise_for_status()
    items = r.json().get("items", [])
    if not items:
        pytest.skip("no cycles yet on this worker")
    tx = items[0].get("tx_hash")
    if not tx:
        pytest.skip("latest cycle has no tx_hash yet")

    v = httpx.get(f"{WORKER_URL}/v1/verify/{tx}", timeout=15)
    v.raise_for_status()
    body = v.json()
    assert body.get("error") is None, f"verify returned error: {body}"
    assert body.get("proofType") in ("onchain_decision_logged", "execution_evidence_only"), body