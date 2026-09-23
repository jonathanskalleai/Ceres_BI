from __future__ import annotations

from fastapi.testclient import TestClient

from auth import CurrentUser
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


def test_core_returns_stable_envelope(monkeypatch) -> None:
    async def fake_user() -> CurrentUser:
        return CurrentUser(id="00000000-0000-0000-0000-000000000001", role="admin")

    app.dependency_overrides[require_bi_user] = fake_user
    monkeypatch.setattr(
        database,
        "execute_rpc",
        lambda name, args: {"kpis": {"totalAcoes": 3}, "porMes": []},
    )
    try:
        response = TestClient(app).get("/api/bi/acoes/core?from=2026-01-01&to=2026-01-31")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["data"]["kpis"]["totalAcoes"] == 3
    assert payload["requestId"]
    assert payload["fetchedAt"]


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
