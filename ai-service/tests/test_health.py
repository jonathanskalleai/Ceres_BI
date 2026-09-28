from __future__ import annotations

from fastapi.testclient import TestClient

import main


def fail_if_database_checked():
    raise AssertionError("liveness must not depend on PostgreSQL")


def test_live_probe_does_not_depend_on_database(monkeypatch) -> None:
    monkeypatch.setattr(main, "database_health", fail_if_database_checked)

    response = TestClient(main.app).get("/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "ceresbi-ai"}


def test_health_fails_closed_when_database_is_degraded(monkeypatch) -> None:
    monkeypatch.setattr(
        main,
        "database_health",
        lambda: {
            "state": "ok",
            "analytical": "unavailable",
            "state_configured": True,
            "analytical_configured": True,
        },
    )
    monkeypatch.setattr(main, "provider_health", lambda: {"configured": True})

    response = TestClient(main.app).get("/health")

    assert response.status_code == 503
    assert response.json()["status"] == "degraded"


def test_health_is_ready_only_when_database_and_provider_are_ready(monkeypatch) -> None:
    monkeypatch.setattr(
        main,
        "database_health",
        lambda: {
            "state": "ok",
            "analytical": "ok",
            "state_configured": True,
            "analytical_configured": True,
        },
    )
    monkeypatch.setattr(main, "provider_health", lambda: {"configured": True})

    response = TestClient(main.app).get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_public_ai_health_does_not_hide_database_failure(monkeypatch) -> None:
    monkeypatch.setattr(
        main,
        "database_health",
        lambda: {"state": "unavailable", "analytical": "ok"},
    )

    response = TestClient(main.app).get("/ai/health")

    assert response.status_code == 503
    assert response.json()["status"] == "degraded"
