from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from semantic_snapshots import (
    fetch_semantic_snapshot,
    normalize_filters,
    semantic_filter_key,
)


class FakeDatabase:
    def __init__(self, rows):
        self.rows = rows
        self.calls = []

    def execute_query(self, query, args=()):
        self.calls.append((query, args))
        return self.rows


def test_filter_key_is_stable_and_ignores_empty_values() -> None:
    first = {"p_to": date(2026, 9, 30), "p_from": "2026-09-01", "p_funis": None}
    second = {"p_funis": [], "p_from": "2026-09-01", "p_to": "2026-09-30"}

    assert normalize_filters(first) == {"p_from": "2026-09-01", "p_to": "2026-09-30"}
    assert semantic_filter_key(first) == semantic_filter_key(second)


def test_fetch_semantic_snapshot_returns_fresh_payload_and_metadata() -> None:
    database = FakeDatabase([{
        "payload": {"kpis": {"faturamento": 10}},
        "status": "ready",
        "data_version": 7,
        "source_from": date(2026, 1, 1),
        "source_to": date(2026, 12, 31),
        "snapshot_at": datetime.now(timezone.utc),
    }])

    result = fetch_semantic_snapshot(
        database,
        "desempenho",
        {"p_from": "2026-09-01", "p_to": "2026-09-30"},
        3600,
    )

    assert result is not None
    payload, metadata = result
    assert payload["kpis"]["faturamento"] == 10
    assert metadata.model == "desempenho"
    assert metadata.version == "etl-7"
    assert metadata.source == "read_model"


def test_fetch_semantic_snapshot_rejects_stale_or_uncovered_data() -> None:
    stale = FakeDatabase([{
        "payload": {"ok": True},
        "status": "ready",
        "data_version": 1,
        "source_from": date(2026, 1, 1),
        "source_to": date(2026, 1, 31),
        "snapshot_at": datetime.now(timezone.utc) - timedelta(hours=2),
    }])
    assert fetch_semantic_snapshot(
        stale, "painel", {"from": "2026-01-01", "to": "2026-01-31"}, 3600
    ) is None

    uncovered = FakeDatabase([{
        "payload": {"ok": True},
        "status": "ready",
        "data_version": 1,
        "source_from": date(2026, 1, 1),
        "source_to": date(2026, 1, 31),
        "snapshot_at": datetime.now(timezone.utc),
    }])
    assert fetch_semantic_snapshot(
        uncovered, "painel", {"from": "2025-12-01", "to": "2026-01-31"}, 3600
    ) is None
