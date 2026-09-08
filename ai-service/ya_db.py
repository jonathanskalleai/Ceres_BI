"""Private database adapter for the conversational BI gateway."""

from __future__ import annotations

import asyncio
import os
from typing import Any

import psycopg2
from fastapi import HTTPException

from ai_logger import log_exception


DATABASE_URL = os.getenv("DATABASE_URL", "")


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
