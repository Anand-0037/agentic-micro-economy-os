from fastapi.testclient import TestClient

from ameo_worker.main import app

client = TestClient(app)
KNOWN_TX = "0xdab19668f7c21501a01b04829b98cfbdb38f125fedabcb6cea86fbd6ec02ecf8"


def test_root() -> None:
    response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert body["service"] == "ameo-worker"
    assert body["status"] == "ok"
    assert "uptime_seconds" in body


def test_v1_skills() -> None:
    response = client.get("/v1/skills")
    assert response.status_code == 200
    body = response.json()
    assert body["skills"][0]["id"] == "mantle.swap.v1"


def test_v1_policies() -> None:
    response = client.get("/v1/policies")
    assert response.status_code == 200
    body = response.json()
    assert len(body["policies"]) == 7


def test_v1_agents_register() -> None:
    response = client.post("/v1/agents", json={})
    assert response.status_code == 200
    body = response.json()
    assert "agentId" in body
    assert "tokenId" in body


def test_v1_agents_get() -> None:
    settings_token = client.post("/v1/agents", json={}).json()["tokenId"]
    response = client.get(f"/v1/agents/{settings_token}")
    assert response.status_code == 200
    assert "decisionCount" in response.json()


def test_v1_decisions_list() -> None:
    response = client.get("/v1/decisions")
    assert response.status_code == 200
    body = response.json()
    assert "items" in body
    assert "total" in body


def test_v1_verify_known_tx() -> None:
    response = client.get(f"/v1/verify/{KNOWN_TX}")
    if response.status_code == 404:
        body = response.json()
        assert "error" in body
        return
    assert response.status_code == 200
    body = response.json()
    assert body["txHash"].lower() == KNOWN_TX.lower()
    assert body["decisionStatus"] == "PASS"


def test_v1_verify_unknown_tx() -> None:
    response = client.get("/v1/verify/0x" + "ab" * 32)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "tx_not_indexed"
