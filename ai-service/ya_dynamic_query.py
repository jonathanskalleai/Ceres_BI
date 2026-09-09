"""Validated, read-only SQL capability for exploratory BI questions.

The model may propose a query, but it never gets database credentials. The
server validates the statement, limits its scope to business tables in
``mirror`` and sanitizes the result before it reaches the narrator or browser.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import time
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Awaitable, Callable

from fastapi import HTTPException

from ai_logger import log_event
from ya_models import YaSource
from ya_query_models import QuerySpec


MAX_QUERY_CHARS = 14_000
MAX_ROWS = 100
MAX_COLUMNS = 24
DEFAULT_MIRROR_TABLES = {
    "mirror.crm_acoes",
    "mirror.crm_negocios",
    "mirror.crm_pedidos",
    "mirror.crm_pedidos_item",
    "mirror.crm_carteira_clientes",
    "mirror.cliente_parque_maquinas",
    "mirror.crm_funil_etapa",
    "mirror.ordens_servico",
    "mirror.usuarios",
    "mirror.sync_control",
    "mirror.sync_metadata",
}
MAX_RESULT_CHARS = 60_000
SENSITIVE_KEY = re.compile(
    r"(?:cpf|cnpj|email|telefone|phone|senha|password|token|secret|authorization|api[_-]?key|documento|cliente[_-]?id|user[_-]?id|cli_idcliente|chassi|serie)",
    re.IGNORECASE,
)
SENSITIVE_TEXT = re.compile(
    r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[-.\s]?\d{4}"
)
FORBIDDEN_SQL = re.compile(
    r"\b(?:insert|update|delete|drop|alter|create|truncate|grant|revoke|vacuum|analyze|call|do|set|reset|prepare|execute|merge|lock|listen|notify|copy|into|nextval|setval|pg_sleep|current_setting|set_config|dblink|lo_export|lo_import|pg_read_file|pg_ls_)\b",
    re.IGNORECASE,
)
RESOURCE_HEAVY_SQL = re.compile(r"\b(?:generate_series|unnest|pg_advisory|txid_current)\b", re.IGNORECASE)
FORBIDDEN_FUNCTION = re.compile(
    r'\b"?(?:pg_[a-z_]+|lo_[a-z_]+|dblink[a-z_]*|query_to_xml|table_to_xml|database_to_xml|'
    r'has_(?:table|schema|database|sequence|any_column)_privilege|version|inet_(?:server|client)_addr)"?\s*\(',
    re.IGNORECASE,
)
QUALIFIED_FUNCTION = re.compile(
    r'"?[A-Za-z_][\w$]*"?\s*\.\s*"?[A-Za-z_][\w$]*"?\s*\(',
    re.IGNORECASE,
)
TABLE_REFERENCE = re.compile(
    r"\b(?:from|join)\s+(?P<reference>(?:\"?[A-Za-z_][\w$]*\"?\.)?(?:\"?[A-Za-z_][\w$]*\"?))",
    re.IGNORECASE,
)
CTE_REFERENCE = re.compile(
    r"(?:\bwith\b|,)\s*(?:recursive\s+)?(?P<name>\"?[A-Za-z_][\w$]*\"?)\s+as\s*\(",
    re.IGNORECASE,
)
MIRROR_OBJECT = re.compile(r"\bmirror\s*\.\s*(?P<object>[A-Za-z_][\w$]*)", re.IGNORECASE)

QueryFn = Callable[[str, tuple[Any, ...] | None], Awaitable[list[dict[str, Any]]]]


class DynamicQueryValidationError(ValueError):
    """Raised when a model-produced query is outside the safe read-only contract."""


@dataclass(frozen=True)
class ValidatedQuery:
    sql: str
    tables: tuple[str, ...]
    query_hash: str


def _mask_literals(sql: str) -> str:
    """Mask string literals while detecting comments and unterminated quotes."""
    chars: list[str] = []
    index = 0
    quote: str | None = None
    while index < len(sql):
        char = sql[index]
        next_char = sql[index + 1] if index + 1 < len(sql) else ""
        if quote == "'":
            if char == "'" and next_char == "'":
                chars.extend((" ", " "))
                index += 2
                continue
            if char == "'":
                quote = None
            chars.append(" ")
            index += 1
            continue
        if quote == '"':
            if char == '"' and next_char == '"':
                chars.extend((char, char))
                index += 2
                continue
            if char == '"':
                quote = None
            chars.append(char)
            index += 1
            continue
        if char == "'":
            quote = char
            chars.append(" ")
            index += 1
            continue
        if char == '"':
            quote = char
            chars.append(char)
            index += 1
            continue
        if char == ";":
            raise DynamicQueryValidationError("A consulta deve conter uma única instrução.")
        if char == "-" and next_char == "-":
            raise DynamicQueryValidationError("Comentários SQL não são aceitos na consulta.")
        if char == "/" and next_char == "*":
            raise DynamicQueryValidationError("Comentários SQL não são aceitos na consulta.")
        if char == "$":
            raise DynamicQueryValidationError("Blocos SQL dinâmicos não são aceitos na consulta.")
        chars.append(char)
        index += 1
    if quote:
        raise DynamicQueryValidationError("A consulta contém uma string não encerrada.")
    return "".join(chars)


def _identifier(value: str) -> str:
    return ".".join(part.strip().strip('"').casefold() for part in value.strip().split("."))


def _allowed_tables(known_tables: set[str] | None) -> set[str]:
    if known_tables is None:
        return DEFAULT_MIRROR_TABLES
    return {_identifier(table) for table in known_tables}.intersection(DEFAULT_MIRROR_TABLES)


def _has_from_comma(masked: str) -> bool:
    """Reject comma joins; explicit JOIN keeps source extraction auditable."""
    depth = 0
    in_from = False
    tokens = re.finditer(r"\b(?:from|where|group|order|having|limit|union)\b|[(),]", masked, re.IGNORECASE)
    for token in tokens:
        value = token.group(0).casefold()
        if value == "(":
            depth += 1
        elif value == ")":
            depth = max(depth - 1, 0)
        elif depth == 0 and value == "from":
            in_from = True
        elif depth == 0 and value in {"where", "group", "order", "having", "limit", "union"}:
            in_from = False
        elif depth == 0 and value == "," and in_from:
            return True
    return False


def validate_read_only_sql(sql: Any, known_tables: set[str] | None = None) -> ValidatedQuery:
    if not isinstance(sql, str) or not sql.strip():
        raise DynamicQueryValidationError("A consulta analítica não foi produzida.")
    clean = sql.strip()
    if clean.endswith(";"):
        clean = clean[:-1].rstrip()
    if len(clean) > MAX_QUERY_CHARS:
        raise DynamicQueryValidationError("A consulta analítica excede o limite permitido.")
    masked = _mask_literals(clean)
    if "\x00" in clean:
        raise DynamicQueryValidationError("A consulta contém um caractere inválido.")
    if not re.match(r"^\s*(?:select|with)\b", masked, re.IGNORECASE):
        raise DynamicQueryValidationError("A consulta precisa ser um SELECT ou WITH somente leitura.")
    if FORBIDDEN_SQL.search(masked):
        raise DynamicQueryValidationError("A consulta contém uma operação não permitida.")
    if RESOURCE_HEAVY_SQL.search(masked):
        raise DynamicQueryValidationError("A consulta contém uma operação de alto custo não permitida.")
    if FORBIDDEN_FUNCTION.search(masked):
        raise DynamicQueryValidationError("A consulta contém uma função de sistema não permitida.")
    if re.search(r"\bwith\s+recursive\b", masked, re.IGNORECASE):
        raise DynamicQueryValidationError("Consultas recursivas não são permitidas na exploração.")
    if re.search(r"\b(?:pg_catalog|information_schema|auth|storage)\b", masked, re.IGNORECASE):
        raise DynamicQueryValidationError("A consulta só pode usar fontes de negócio do BI.")
    if QUALIFIED_FUNCTION.search(masked):
        raise DynamicQueryValidationError("Funções de schema não são permitidas na consulta exploratória.")
    if _has_from_comma(masked):
        raise DynamicQueryValidationError("Use JOIN explícito entre as fontes da consulta.")
    if re.search(r"\bselect\s+(?:distinct\s+)?(?:[A-Za-z_][\w$]*\.)?\*(?![\w$])", masked, re.IGNORECASE):
        raise DynamicQueryValidationError("Selecione colunas explícitas; SELECT * não é permitido.")
    if re.search(r"\bfor\s+(?:update|share|no\s+key)\b", masked, re.IGNORECASE):
        raise DynamicQueryValidationError("Bloqueios de linha não são permitidos.")

    ctes = {_identifier(match.group("name")) for match in CTE_REFERENCE.finditer(masked)}
    references = [_identifier(match.group("reference")) for match in TABLE_REFERENCE.finditer(masked)]
    tables: list[str] = []
    allowed_tables = _allowed_tables(known_tables)
    for reference in references:
        if reference in ctes:
            continue
        parts = reference.split(".")
        if len(parts) != 2 or parts[0] != "mirror":
            raise DynamicQueryValidationError("Qualifique cada fonte com uma tabela de negócio mirror.")
        if reference not in allowed_tables:
            raise DynamicQueryValidationError("A tabela solicitada não está disponível no schema atual.")
        tables.append(reference)
    if not tables:
        raise DynamicQueryValidationError("A consulta precisa ler pelo menos uma tabela mirror.")
    mirror_objects = {_identifier(match.group("object")) for match in MIRROR_OBJECT.finditer(masked)}
    if any(f"mirror.{name}" not in allowed_tables for name in mirror_objects):
        raise DynamicQueryValidationError("A consulta referencia uma tabela mirror indisponível.")
    normalized = " ".join(clean.split())
    return ValidatedQuery(
        sql=clean,
        tables=tuple(dict.fromkeys(tables)),
        query_hash=hashlib.sha256(normalized.encode("utf-8")).hexdigest(),
    )


def _safe_value(value: Any, depth: int = 0) -> Any:
    if depth > 3:
        return "…"
    if isinstance(value, dict):
        output: dict[str, Any] = {}
        for key, item in list(value.items())[:MAX_COLUMNS]:
            key_text = str(key)
            if SENSITIVE_KEY.search(key_text):
                continue
            output[key_text] = _safe_value(item, depth + 1)
        return output
    if isinstance(value, (list, tuple)):
        return [_safe_value(item, depth + 1) for item in list(value)[:50]]
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, bytes):
        return "[oculto]"
    if isinstance(value, str):
        return SENSITIVE_TEXT.sub("[oculto]", value[:320])
    return value


def _safe_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [_safe_value(row) for row in rows[: MAX_ROWS + 1] if isinstance(row, dict)]


class DynamicQueryExecutor:
    def __init__(self, read_only_query: QueryFn):
        self._read_only_query = read_only_query

    async def execute(
        self,
        spec: QuerySpec,
        sql: str,
        user_id: str,
        freshness: dict[str, Any],
        known_tables: set[str] | None = None,
    ) -> tuple[str, Any, YaSource, bool]:
        try:
            validated = validate_read_only_sql(sql, known_tables)
        except DynamicQueryValidationError:
            raise
        started = time.monotonic()
        try:
            wrapped = f"SELECT * FROM ({validated.sql}) AS ya_agent_result LIMIT {MAX_ROWS + 1}"
            # Passing None keeps literal percent signs (for example LIKE '%texto%')
            # untouched by psycopg2's parameter interpolation layer.
            raw_rows = await self._read_only_query(wrapped, None)
        except HTTPException as error:
            log_event(logging.WARNING, "ai_dynamic_query_failed", status_code=error.status_code, query_hash=validated.query_hash[:16])
            raise HTTPException(status_code=503, detail="A fonte necessária não respondeu para esta pergunta.") from error
        except Exception as error:
            log_event(logging.WARNING, "ai_dynamic_query_unexpected_failure", error_type=type(error).__name__, query_hash=validated.query_hash[:16])
            raise HTTPException(status_code=503, detail="A fonte necessária não respondeu para esta pergunta.") from error

        safe_rows = _safe_rows(raw_rows)
        truncated = len(safe_rows) > MAX_ROWS
        safe_rows = safe_rows[:MAX_ROWS]
        data: dict[str, Any] = {
            "status": "computed",
            "rows": safe_rows,
            "row_count": len(safe_rows),
            "truncated": truncated,
        }
        while len(json.dumps(data, ensure_ascii=False, default=str)) > MAX_RESULT_CHARS and data["rows"]:
            data["rows"].pop()
            data["truncated"] = True
        data["row_count"] = len(data["rows"])
        columns = list(dict.fromkeys(key for row in data["rows"] for key in row))[:MAX_COLUMNS]
        data["columns"] = columns
        warnings = list(spec.warnings)
        if not spec.period:
            warnings.append("A consulta exploratória foi executada sem período temporal explícito.")
        warnings.append("O resultado veio de uma consulta exploratória, fora do contrato de um card canônico da dashboard.")
        source = YaSource(
            id=f"dynamic:{validated.query_hash[:16]}",
            label="Consulta analítica ao banco do BI",
            filters={**spec.filters},
            requested_filters={**spec.requested_filters},
            refreshed_at=freshness.get("refreshed_at"),
            intent=spec.intent,
            applied_scope={
                "period": spec.period.model_dump(mode="json", by_alias=True) if spec.period else None,
                "filters": spec.filters,
                "filter_origins": spec.filter_origins,
                "timezone": spec.period.timezone if spec.period else "America/Sao_Paulo",
                "scope_type": "exploratory",
            },
            freshness=freshness,
            lineage={
                "executor": "dynamic_read_only",
                "tables": list(validated.tables),
                "columns": columns,
                "query_hash": validated.query_hash,
                "query_version": "2026-09-08.2",
            },
            warnings=list(dict.fromkeys(warnings)),
            execution_metrics={
                "elapsed_ms": round((time.monotonic() - started) * 1000),
                "row_count": len(safe_rows),
                "cache_hit": False,
                "truncated": truncated,
                "mode": "read_only",
            },
            preview=data,
        )
        log_event(
            logging.INFO,
            "ai_dynamic_query_completed",
            user_id=user_id,
            query_hash=validated.query_hash[:16],
            table_count=len(validated.tables),
            row_count=len(safe_rows),
        )
        return "dynamic_read_only", data, source, False
