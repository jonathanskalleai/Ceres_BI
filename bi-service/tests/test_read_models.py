from __future__ import annotations

from datetime import date

import pytest
from fastapi import HTTPException

from read_models import (
    build_read_model_query,
    fetch_read_model,
    fetch_read_model_health,
    fetch_read_model_status,
)


def test_build_read_model_query_allowlists_table_and_binds_filters() -> None:
    query, args = build_read_model_query(
        "acoes_daily",
        date(2026, 1, 1),
        date(2026, 1, 31),
        "Ana",
        "São Paulo",
        100,
    )

    assert "FROM bi.acoes_daily" in query
    assert "vendedor = %s" in query
    assert "cidade = %s" in query
    assert args == (date(2026, 1, 1), date(2026, 1, 31), "Ana", "São Paulo", 100, 0)


def test_build_read_model_query_rejects_unlisted_model() -> None:
    with pytest.raises(HTTPException) as error:
        build_read_model_query(
            "mirror.crm_acoes", date(2026, 1, 1), date(2026, 1, 31), None, None, 10
        )

    assert error.value.status_code == 404


class FakeDatabase:
    def __init__(self) -> None:
        self.calls: list[tuple[str, tuple[object, ...]]] = []

    def execute_query(self, query: str, args: tuple[object, ...] = ()) -> list[dict[str, object]]:
        self.calls.append((query, args))
        if "read_model_quality" in query:
            return [{"model_name": "acoes_daily", "status": "ready", "delta": 0}]
        if "refresh_manifest" in query:
            return [{"model_name": "acoes_daily", "status": "ready", "data_version": 1}]
        return [{"day": date(2026, 1, 1), "total_acoes": 3}]


def test_fetch_read_model_returns_rows_and_manifest() -> None:
    database = FakeDatabase()

    result = fetch_read_model(
        database, "acoes_daily", date(2026, 1, 1), date(2026, 1, 31), None, None, 50
    )

    assert result["model"] == "acoes_daily"
    assert result["rows"] == [{"day": date(2026, 1, 1), "total_acoes": 3}]
    assert result["manifest"] == {"model_name": "acoes_daily", "status": "ready", "data_version": 1}
    assert result["pagination"] == {"limit": 50, "offset": 0, "has_more": False}


def test_fetch_read_model_status_requires_all_quality_checks_ready() -> None:
    status = fetch_read_model_status(FakeDatabase())

    assert status["status"] == "ready"
    assert status["quality"] == [{"model_name": "acoes_daily", "status": "ready", "delta": 0}]


def test_fetch_read_model_health_flags_missing_or_stale_models() -> None:
    class HealthDatabase(FakeDatabase):
        def execute_query(self, query: str, args: tuple[object, ...] = ()) -> list[dict[str, object]]:
            if "EXTRACT(EPOCH" in query:
                return [{
                    "model_name": "acoes_daily",
                    "status": "ready",
                    "last_completed_at": "2026-09-23T20:00:00Z",
                    "age_seconds": 7200,
                }]
            return super().execute_query(query, args)

    health = fetch_read_model_health(HealthDatabase(), 3600)

    assert health["status"] == "degraded"
    assert "acoes_daily" in health["staleModels"]
    assert len(health["staleModels"]) == 4
