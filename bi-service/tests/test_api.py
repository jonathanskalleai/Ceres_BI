from __future__ import annotations

import asyncio
import json
import logging
from datetime import date

from fastapi.testclient import TestClient

import main as main_module
from auth import CurrentUser
from main import app, database, query_cache, require_bi_user


def test_health_reports_missing_configuration_without_exposing_secrets() -> None:
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["service"] == "ceresbi-bi"
    assert "databaseUrl" not in payload

    public_response = TestClient(app).get("/api/bi/health")
    assert public_response.status_code == 200
    assert public_response.json() == payload


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
    assert query_event["dashboard_id"] == "bi_acoes"
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


def test_read_model_routes_are_protected_bounded_and_enveloped(monkeypatch) -> None:
    async def fake_user() -> CurrentUser:
        return CurrentUser(id="00000000-0000-0000-0000-000000000001", role="admin")

    def fake_query(query, args=()):
        if "read_model_quality" in query:
            return [{"model_name": "acoes_daily", "status": "ready", "delta": 0}]
        if "refresh_manifest" in query:
            return [{"model_name": "acoes_daily", "status": "ready", "data_version": 3}]
        return [{"day": "2026-01-01", "total_acoes": 4}]

    app.dependency_overrides[require_bi_user] = fake_user
    monkeypatch.setattr(database, "execute_query", fake_query)
    try:
        status_response = TestClient(app).get("/api/bi/model-status")
        model_response = TestClient(app).get(
            "/api/bi/models/acoes_daily?from=2026-01-01&to=2026-01-31&limit=10",
        )
        invalid_model = TestClient(app).get("/api/bi/models/mirror.crm_acoes")
        oversized_limit = TestClient(app).get("/api/bi/models/acoes_daily?limit=10001")
    finally:
        app.dependency_overrides.clear()

    assert status_response.status_code == 200
    assert status_response.json()["data"]["status"] == "ready"
    assert model_response.status_code == 200
    assert model_response.json()["data"]["rows"][0]["total_acoes"] == 4
    assert invalid_model.status_code == 404
    assert oversized_limit.status_code == 422


def test_read_model_route_exposes_stale_and_outside_coverage(monkeypatch) -> None:
    async def fake_user() -> CurrentUser:
        return CurrentUser(id="00000000-0000-0000-0000-000000000001", role="admin")

    def fake_query(query, args=()):
        if "refresh_manifest" in query:
            return [{
                "model_name": "acoes_daily",
                "status": "error",
                "data_version": 3,
                "source_from": date(2026, 1, 1),
                "source_to": date(2026, 1, 31),
            }]
        return [{"day": "2026-01-01", "total_acoes": 4}]

    app.dependency_overrides[require_bi_user] = fake_user
    monkeypatch.setattr(database, "execute_query", fake_query)
    try:
        response = TestClient(app).get(
            "/api/bi/models/acoes_daily?from=2026-02-01&to=2026-02-28&limit=10",
        )
    finally:
        app.dependency_overrides.clear()

    payload = response.json()
    assert response.status_code == 200
    assert payload["status"] == "partial"
    assert {issue["code"] for issue in payload["issues"]} == {
        "BI_READ_MODEL_NOT_READY",
        "BI_READ_MODEL_OUTSIDE_COVERAGE",
    }


def test_batch_runs_primary_blocks_and_emits_one_canonical_event(monkeypatch, caplog) -> None:
    async def fake_user() -> CurrentUser:
        return CurrentUser(id="00000000-0000-0000-0000-000000000001", role="admin")

    app.dependency_overrides[require_bi_user] = fake_user
    monkeypatch.setattr(main_module, "fetch_core", lambda database, filters: {"kpis": {"totalAcoes": 3}})
    monkeypatch.setattr(main_module, "fetch_funil", lambda database, filters: {"funil": {"visitas": 2}})
    caplog.set_level(logging.INFO, logger="ceresbi.bi")
    try:
        response = TestClient(app).get(
            "/api/bi/acoes/batch?from=2026-01-01&to=2026-01-31",
            headers={"X-Request-ID": "req:batch-1"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["data"] == {"core": {"kpis": {"totalAcoes": 3}}, "funil": {"funil": {"visitas": 2}}}
    events = [json.loads(record.message) for record in caplog.records if record.message.startswith('{"')]
    query_event = next(event for event in events if event.get("event") == "bi_query" and event.get("endpoint") == "acoes.batch")
    assert query_event["request_id"] == "req:batch-1"
    assert query_event["status"] == "ok"


def test_batch_reports_partial_without_fabricating_failed_block(monkeypatch) -> None:
    async def fake_user() -> CurrentUser:
        return CurrentUser(id="00000000-0000-0000-0000-000000000001", role="admin")

    app.dependency_overrides[require_bi_user] = fake_user
    asyncio.run(query_cache.clear())
    monkeypatch.setattr(main_module, "fetch_core", lambda database, filters: {"kpis": {"totalAcoes": 3}})

    def fail_funil(database, filters):
        raise TimeoutError("database timeout")

    monkeypatch.setattr(main_module, "fetch_funil", fail_funil)
    try:
        response = TestClient(app).get("/api/bi/acoes/batch?from=2026-01-01&to=2026-01-31")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "partial"
    assert payload["data"] == {"core": {"kpis": {"totalAcoes": 3}}}
    assert payload["issues"][0]["code"] == "BI_BATCH_FUNIL_FAILED"


def test_generic_rpc_gateway_validates_args_and_emits_dashboard_event(monkeypatch, caplog) -> None:
    monkeypatch.setattr(
        main_module,
        "authenticate_bi_user",
        lambda *args, **kwargs: CurrentUser(
            id="00000000-0000-0000-0000-000000000001",
            role="admin",
        ),
    )
    calls = []

    def fake_execute(name, args):
        calls.append((name, args))
        return {"kpis": {"total": 7}}

    monkeypatch.setattr(database, "execute_rpc", fake_execute)
    caplog.set_level(logging.INFO, logger="ceresbi.bi")
    response = TestClient(app).post(
        "/api/bi/rpc/rpc_pedidos_bi",
        json={"params": {"p_from": "2026-01-01", "p_to": "2026-01-31"}},
        headers={"X-Request-ID": "req:generic-1"},
    )

    assert response.status_code == 200
    assert response.json()["data"] == {"kpis": {"total": 7}}
    assert calls[0][0] == "rpc_pedidos_bi"
    assert str(calls[0][1][0]) == "2026-01-01"
    assert str(calls[0][1][1]) == "2026-01-31"
    events = [json.loads(record.message) for record in caplog.records if record.message.startswith('{"')]
    query_event = next(event for event in events if event.get("event") == "bi_query")
    assert query_event["dashboard_id"] == "bi.pedidos"
    assert query_event["rpc"] == "rpc_pedidos_bi"
    assert query_event["case"] == "monthly"


def test_generic_rpc_gateway_rejects_unknown_rpc_and_invalid_params(monkeypatch) -> None:
    auth_mock = lambda *args, **kwargs: CurrentUser(
        id="00000000-0000-0000-0000-000000000001",
        role="admin",
    )
    monkeypatch.setattr(main_module, "authenticate_bi_user", auth_mock)
    unknown = TestClient(app).post("/api/bi/rpc/rpc_not_allowed", json={"params": {}})
    invalid = TestClient(app).post(
        "/api/bi/rpc/rpc_pedidos_bi",
        json={"params": {"p_from": "2026-02-01", "p_to": "2026-01-01", "p_unknown": "x"}},
    )
    assert unknown.status_code == 404
    assert invalid.status_code == 422


def test_generic_rpc_gateway_reports_cache_hit_without_repeating_query(monkeypatch) -> None:
    monkeypatch.setattr(
        main_module,
        "authenticate_bi_user",
        lambda *args, **kwargs: CurrentUser(
            id="00000000-0000-0000-0000-000000000099",
            role="admin",
        ),
    )
    asyncio.run(query_cache.clear())
    calls = 0

    def fake_execute(name, args):
        nonlocal calls
        calls += 1
        return {"total": calls}

    monkeypatch.setattr(database, "execute_rpc", fake_execute)
    payload = {"params": {"p_from": "2026-02-01", "p_to": "2026-02-28"}}
    first = TestClient(app).post("/api/bi/rpc/rpc_pedidos_bi", json=payload)
    second = TestClient(app).post("/api/bi/rpc/rpc_pedidos_bi", json=payload)

    assert first.status_code == second.status_code == 200
    assert first.json()["data"] == {"total": 1}
    assert second.json()["data"] == {"total": 1}
    assert first.json()["metrics"]["cache_hit"] is False
    assert second.json()["metrics"]["cache_hit"] is True
    assert calls == 1
