from __future__ import annotations

import time
from typing import Self

import pytest
from psycopg2 import pool

import db as db_module
from config import Settings
from db import ReadOnlyDatabase


class _FakeConnection:
    def set_session(self, **_: object) -> None:
        return None

    def cursor(self) -> _FakeCursor:
        return _FakeCursor()


class _FakeCursor:
    description = (("mes",), ("oportunidades",))

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def execute(self, *_: object) -> None:
        return None

    def fetchall(self) -> list[tuple[object, ...]]:
        return [("2026-01", 12), ("2026-02", 8)]


class _FakePool:
    def __init__(self, *_: object, **__: object) -> None:
        self.connection = _FakeConnection()

    def getconn(self) -> _FakeConnection:
        return self.connection

    def putconn(self, _: _FakeConnection) -> None:
        return None

    def closeall(self) -> None:
        return None


def _settings(wait_timeout_ms: int) -> Settings:
    return Settings(
        database_url="postgresql://test",
        jwt_secret="jwt",
        jwt_audience="authenticated",
        pool_min=1,
        pool_max=1,
        pool_wait_timeout_ms=wait_timeout_ms,
        statement_timeout_ms=30_000,
        lock_timeout_ms=5_000,
        cache_ttl_seconds=5,
        cache_max_items=10,
        cache_max_entry_bytes=1_000_000,
        read_model_max_age_seconds=3_600,
        cors_origins=("https://example.test",),
    )


def test_connection_waits_for_pool_slot_before_returning(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(db_module.pool, "ThreadedConnectionPool", _FakePool)
    database = ReadOnlyDatabase(_settings(100))
    database.start()
    assert database._pool_slots is not None
    assert database._pool_slots.acquire(timeout=0)
    database._pool_slots.release()

    started = time.perf_counter()
    with database.connection() as connection:
        elapsed_ms = (time.perf_counter() - started) * 1000
        assert isinstance(connection, _FakeConnection)

    assert elapsed_ms < 100


def test_connection_returns_bounded_pool_error_instead_of_spinning(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(db_module.pool, "ThreadedConnectionPool", _FakePool)
    database = ReadOnlyDatabase(_settings(1))
    database.start()
    assert database._pool_slots is not None
    assert database._pool_slots.acquire(timeout=0)
    try:
        with pytest.raises(pool.PoolError, match="tempo limite"), database.connection():
            pass
    finally:
        database._pool_slots.release()


def test_execute_rpc_expands_table_functions_into_named_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(db_module.pool, "ThreadedConnectionPool", _FakePool)
    database = ReadOnlyDatabase(_settings(100))
    assert database.execute_rpc("rpc_evolucao_ganhos_perdidos_12m", (None, None, None)) == [
        {"mes": "2026-01", "oportunidades": 12},
        {"mes": "2026-02", "oportunidades": 8},
    ]
