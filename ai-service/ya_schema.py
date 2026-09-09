"""Runtime discovery of the business schema exposed to the BI agent."""

from __future__ import annotations

import logging
import os
import re
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from fastapi import HTTPException

from ai_logger import log_event
from ya_db import query_async
from ya_dynamic_query import DEFAULT_MIRROR_TABLES


SCHEMA_CACHE_TTL_SECONDS = int(os.getenv("YA_SCHEMA_CACHE_TTL_SECONDS", "300"))
SCHEMA_PROMPT_MAX_CHARS = 18_000
SENSITIVE_COLUMN = re.compile(
    r"(?:cpf|cnpj|email|telefone|phone|senha|password|token|secret|authorization|api[_-]?key|chassi|serie)",
    re.IGNORECASE,
)
QueryFn = Callable[[str, tuple[Any, ...]], Awaitable[list[dict[str, Any]]]]


@dataclass(frozen=True)
class SchemaSnapshot:
    tables: dict[str, tuple[str, ...]]
    refreshed_at: float
    available: bool = True

    @property
    def table_names(self) -> set[str]:
        return set(self.tables)

    def prompt_text(self) -> str:
        if not self.tables:
            return "SCHEMA RUNTIME: indisponível nesta rodada; não invente nomes de tabelas ou colunas."
        lines = ["SCHEMA RUNTIME (somente tabelas de negócio do schema mirror):"]
        for table_name, columns in sorted(self.tables.items()):
            if table_name not in DEFAULT_MIRROR_TABLES:
                continue
            visible = [column for column in columns if not SENSITIVE_COLUMN.search(column)]
            lines.append(f"- {table_name}: {', '.join(visible) or '(nenhuma coluna textual exibível)'}")
        return "\n".join(lines)[:SCHEMA_PROMPT_MAX_CHARS]


_cached: tuple[int, SchemaSnapshot] | None = None


def clear_schema_cache() -> None:
    global _cached
    _cached = None


async def load_schema(query_fn: QueryFn = query_async) -> SchemaSnapshot:
    global _cached
    query_identity = id(query_fn)
    now = time.monotonic()
    if _cached and _cached[0] == query_identity and now - _cached[1].refreshed_at < SCHEMA_CACHE_TTL_SECONDS:
        return _cached[1]
    try:
        rows = await query_fn(
            """
            SELECT table_schema, table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = %s
            ORDER BY table_name, ordinal_position
            """,
            ("mirror",),
        )
        tables: dict[str, list[str]] = {}
        for row in rows:
            table = f"{str(row.get('table_schema') or '').lower()}.{str(row.get('table_name') or '').lower()}"
            column = str(row.get("column_name") or "").lower()
            if table != "." and column:
                tables.setdefault(table, []).append(column)
        snapshot = SchemaSnapshot(
            tables={name: tuple(columns) for name, columns in tables.items()},
            refreshed_at=now,
            available=True,
        )
    except HTTPException as error:
        log_event(logging.WARNING, "ai_schema_discovery_failed", status_code=error.status_code)
        snapshot = SchemaSnapshot(tables={}, refreshed_at=now, available=False)
    except Exception as error:
        log_event(logging.WARNING, "ai_schema_discovery_unexpected_failure", error_type=type(error).__name__)
        snapshot = SchemaSnapshot(tables={}, refreshed_at=now, available=False)
    _cached = (query_identity, snapshot)
    return snapshot
