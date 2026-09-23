from __future__ import annotations

import json
import logging

from auth import CurrentUser
from fastapi.testclient import TestClient
from main import app, database, require_bi_user


def test_health_reports_missing_configuration_without_exposing_secrets() -> None:
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["service"] == "ceresbi-bi"
    assert "databaseUrl" not in payload


def test_protected_endpoint_requires_bearer_token() -> None:
    response = TestClient(app).get("/api/bi/acoes/core")
    assert response.status_code == 503
    assert "JWT" in response.json()["detail"]


def test_core_returns_stable_envelope_and_redacted_query_event(monkeypatch, caplog) -> None:
    async def fake_user() -> CurrentUser:
        return CurrentUser(id="00000000-0000-0000-0000-000000000001", role="admin")

    app.dependency_overrides[require_bi_user] = fake_user
    monkeypatch.setattr(
        database,
        "execute_rpc",
        lambda name, args: {"kpis": {"totalAcoes": 3}, "porMes": []},
    )
    caplog.set_level(logging.INFO, logger="ceresbi.bi")
    try:
        response = TestClient(app).get(
            "/api/bi/acoes/core?from=2026-01-01&to=2026-01-31&cidade=Não%20registrar",
            headers={"X-Request-ID": "req:monthly-1"},
        )
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["data"]["kpis"]["totalAcoes"] == 3
    assert payload["requestId"]
    assert payload["fetchedAt"]
    assert payload["metrics"]["query_ms"] >= 0
    assert payload["metrics"]["api_ms"] >= payload["metrics"]["query_ms"]
    assert payload["metrics"]["payload_bytes"] > 0
    events = [json.loads(record.message) for record in caplog.records if record.message.startswith('{"')]
    query_event = next(event for event in events if event.get("event") == "bi_query")
    assert query_event["request_id"] == "req:monthly-1"
    assert query_event["dashboard_id"] == "acoes"
    assert query_event["case"] == "monthly"
    assert query_event["rpc"] == "rpc_acoes_bi_periodo"
    assert all("Não registrar" not in record.message for record in caplog.records)


def test_query_validation_rejects_invalid_period_and_oversized_filter() -> None:
    async def fake_user() -> CurrentUser:
        return CurrentUser(id="00000000-0000-0000-0000-000000000001", role="admin")

    app.dependency_overrides[require_bi_user] = fake_user
    try:
        invalid_period = TestClient(app).get(
            "/api/bi/acoes/core?from=2026-12-31&to=2026-01-01",
        )
        oversized_city = TestClient(app).get(
            f"/api/bi/acoes/core?cidade={'á' * 161}",
        )
    finally:
        app.dependency_overrides.clear()

    assert invalid_period.status_code == 422
    assert oversized_city.status_code == 422
