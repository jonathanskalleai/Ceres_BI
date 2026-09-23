"""Small read-only PostgreSQL pool used by the BI API."""

from __future__ import annotations

import json
from contextlib import contextmanager
from typing import Any, Iterator

from psycopg2 import pool

from config import Settings


class ReadOnlyDatabase:
    """Thread-safe pool with a read-only transaction boundary."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._pool: pool.ThreadedConnectionPool | None = None

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
        )

    def close(self) -> None:
        if self._pool is not None:
            self._pool.closeall()
            self._pool = None

    @property
    def configured(self) -> bool:
        return bool(self.settings.database_url)

    @contextmanager
    def connection(self) -> Iterator[Any]:
        if self._pool is None:
            self.start()
        if self._pool is None:
            raise RuntimeError("BI_DATABASE_URL não configurada")
        conn = self._pool.getconn()
        try:
            # This is defense in depth. The role must also be provisioned as a
            # read-only role in PostgreSQL; the API never uses postgres.
            conn.set_session(
                autocommit=True,
                readonly=True,
                options=(
                    f"-c statement_timeout={self.settings.statement_timeout_ms} "
                    f"-c lock_timeout={self.settings.lock_timeout_ms}"
                ),
            )
            yield conn
        finally:
            self._pool.putconn(conn)

    def execute_rpc(self, function_name: str, args: tuple[Any, ...]) -> Any:
        # Function names are selected only from the internal allow-list in
        # rpc.py; do not interpolate user input here.
        placeholders = ", ".join(["%s"] * len(args))
        query = f"SELECT public.{function_name}({placeholders})"
        with self.connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query, args)
                row = cursor.fetchone()
        if not row:
            raise RuntimeError(f"RPC {function_name} não retornou dados")
        value = row[0]
        if isinstance(value, str):
            return json.loads(value)
        return value

    def ping(self) -> bool:
        with self.connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                return cursor.fetchone() == (1,)
