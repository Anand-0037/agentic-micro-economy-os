from fastapi.testclient import TestClient

from ameo_worker.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "signing_eoa" in body
    assert body["policy_caps"]["max_position_usd"] == 250.0
    assert body["policy_caps"]["max_daily_volume_usd"] == 500.0


def test_api_policy() -> None:
    response = client.get("/api/policy")
    assert response.status_code == 200
    body = response.json()
    assert body["max_drawdown_pct"] == 0.12
    assert "allowed_assets" in body


def test_api_public_config() -> None:
    response = client.get("/api/public-config")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["mantle_chain_id"], int)
    assert "mantle_rpc_netloc" in body
    assert "allows_live_execution" in body
    assert "daily_notional_usd_today" in body


def test_api_decisions() -> None:
    response = client.get("/api/decisions")
    assert response.status_code == 200
    body = response.json()
    assert "logs" in body
    assert isinstance(body["logs"], list)


def test_api_mantle_probe() -> None:
    response = client.get("/api/mantle-probe")
    assert response.status_code == 200
    body = response.json()
    assert "ok" in body


def test_api_eval_report_present() -> None:
    response = client.get("/api/eval-report")
    assert response.status_code == 200
    body = response.json()
    assert body.get("available") is True
    assert "report" in body
    assert body["report"].get("sample_count", body["report"].get("cycles_observed")) is not None
