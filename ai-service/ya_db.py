"""Private database adapter for the conversational BI gateway."""

from __future__ import annotations

import asyncio
import os
from typing import Any

import psycopg2
from fastapi import HTTPException

from ai_logger import log_exception


DATABASE_URL = os.getenv("DATABASE_URL", "")


def _bounded_ms(name: str, default: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return max(100, min(value, maximum))


DYNAMIC_QUERY_TIMEOUT_MS = _bounded_ms("YA_DYNAMIC_QUERY_TIMEOUT_MS", 8_000, 30_000)
DYNAMIC_QUERY_LOCK_TIMEOUT_MS = _bounded_ms("YA_DYNAMIC_QUERY_LOCK_TIMEOUT_MS", 1_500, 10_000)


def _connection():
    if not DATABASE_URL:
        raise HTTPException(status_code=503, detail="Banco de dados da AI não configurado")
    return psycopg2.connect(DATABASE_URL)


def query(sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    connection = None
    try:
        connection = _connection()
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            columns = [item[0] for item in cursor.description] if cursor.description else []
            rows = [dict(zip(columns, row)) for row in cursor.fetchall()] if columns else []
        connection.commit()
        return rows
    except psycopg2.Error as error:
        if connection:
            connection.rollback()
        log_exception("ai_database_query_failed", error, statement_kind="approved_contract")
        raise HTTPException(status_code=503, detail="Não foi possível consultar os dados do BI") from error
    finally:
        if connection:
            connection.close()


async def query_async(sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, query, sql, params)


def query_read_only(sql: str, params: tuple[Any, ...] | None = None) -> list[dict[str, Any]]:
    """Run one dynamic-agent query inside a read-only, time-bounded transaction."""
    connection = None
    try:
        connection = _connection()
        with connection.cursor() as cursor:
            cursor.execute("SET TRANSACTION READ ONLY")
            cursor.execute("SET LOCAL statement_timeout = %s", (f"{DYNAMIC_QUERY_TIMEOUT_MS}ms",))
            cursor.execute("SET LOCAL lock_timeout = %s", (f"{DYNAMIC_QUERY_LOCK_TIMEOUT_MS}ms",))
            cursor.execute(sql, params)
            columns = [item[0] for item in cursor.description] if cursor.description else []
            return [dict(zip(columns, row)) for row in cursor.fetchall()] if columns else []
    except psycopg2.Error as error:
        log_exception("ai_dynamic_read_only_query_failed", error, statement_kind="dynamic_read_only")
        raise HTTPException(status_code=503, detail="Não foi possível consultar os dados do BI") from error
    finally:
        if connection:
            connection.close()


async def query_read_only_async(sql: str, params: tuple[Any, ...] | None = None) -> list[dict[str, Any]]:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, query_read_only, sql, params)
