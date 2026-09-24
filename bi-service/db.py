"""Small read-only PostgreSQL pool used by the BI API."""

from __future__ import annotations

import json
import logging
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from psycopg2 import pool

from config import Settings

logger = logging.getLogger("ceresbi.bi.db")


class ReadOnlyDatabase:
    """Thread-safe pool with a read-only transaction boundary."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._pool: pool.ThreadedConnectionPool | None = None
        self._pool_slots: threading.BoundedSemaphore | None = None

    def start(self) -> None:
        if not self.settings.database_url:
            return
        if self._pool is not None:
            return
        self._pool = pool.ThreadedConnectionPool(
            self.settings.pool_min,
            self.settings.pool_max,
            self.settings.database_url,
            connect_timeout=5,
            application_name="ceresbi-bi-api",
            options=(
                f"-c statement_timeout={self.settings.statement_timeout_ms} "
                f"-c lock_timeout={self.settings.lock_timeout_ms}"
            ),
        )
        # psycopg2 raises PoolError immediately when every connection is busy.
        # Keep that failure from becoming a burst of avoidable 503s by
        # queueing callers for a bounded interval before giving up.
        self._pool_slots = threading.BoundedSemaphore(self.settings.pool_max)

    def close(self) -> None:
        if self._pool is not None:
            self._pool.closeall()
            self._pool = None
            self._pool_slots = None

    @property
    def configured(self) -> bool:
        return bool(self.settings.database_url)

    @contextmanager
    def connection(self) -> Iterator[Any]:
        if self._pool is None:
            self.start()
        if self._pool is None:
            raise RuntimeError("BI_DATABASE_URL não configurada")
        slots = self._pool_slots
        if slots is None:
            raise RuntimeError("pool do BI não foi inicializado")
        wait_seconds = self.settings.pool_wait_timeout_ms / 1000
        acquired = slots.acquire(timeout=wait_seconds)
        if not acquired:
            logger.warning(
                "bi_db_pool_wait_timeout pool_max=%s wait_timeout_ms=%s",
                self.settings.pool_max,
                self.settings.pool_wait_timeout_ms,
            )
            raise pool.PoolError("tempo limite aguardando conexão do pool BI")
        conn = None
        try:
            conn = self._pool.getconn()
            # This is defense in depth. The role must also be provisioned as a
            # read-only role in PostgreSQL; the API never uses postgres.
            conn.set_session(
                autocommit=True,
                readonly=True,
            )
            yield conn
        finally:
            if conn is not None:
                self._pool.putconn(conn)
            slots.release()

    def execute_rpc(self, function_name: str, args: tuple[Any, ...]) -> Any:
        # Function names are selected only from the internal allow-list in
        # rpc.py; do not interpolate user input here.
        placeholders = ", ".join(["%s"] * len(args))
        query = f"SELECT public.{function_name}({placeholders})"
        with self.connection() as conn, conn.cursor() as cursor:
            cursor.execute(query, args)
            row = cursor.fetchone()
        if not row:
            raise RuntimeError(f"RPC {function_name} não retornou dados")
        value = row[0]
        if isinstance(value, str):
            return json.loads(value)
        return value

    def execute_query(self, query: str, args: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        """Execute a parameterized read-model query and return named rows."""
        with self.connection() as conn, conn.cursor() as cursor:
            cursor.execute(query, args)
            columns = [description[0] for description in cursor.description or ()]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]

    def ping(self) -> bool:
        with self.connection() as conn, conn.cursor() as cursor:
            cursor.execute("SELECT 1")
            return cursor.fetchone() == (1,)
