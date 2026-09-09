"""Shared boundaries for v2 tool execution and human-safe evidence."""

from __future__ import annotations

import json
import time
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

from ai_logger import log_event
from ya_agent_models import AgentArtifact, ArtifactColumn, ToolExecution, ToolFilters
from ya_catalog import CATALOG_VERSION
from ya_models import YaSource
from ya_tool_utils import _compact, _number, _row_label


QueryFn = Callable[[str, tuple[Any, ...] | None], Awaitable[list[dict[str, Any]]]]

MAX_TOOL_ROWS = 100
MAX_TOOL_COLUMNS = 24
MAX_TOOL_RESULT_CHARS = 60_000
FUNNEL_LABELS = {
    "padrao": "padrão (Repasse de Máquina excluído)",
    "todos": "todos os funis, incluindo Repasse de Máquina",
    "somente_repasse": "somente Repasse de Máquina",
    "selecionados": "funis selecionados",
}
KNOWN_REPASSE = ("REPASSE DE MAQUINA", "REPASSE DE MÁQUINA")


@dataclass
class ToolContext:
    user_id: str
    conversation_id: str
    message_id: str
    query: QueryFn
    analytical_query: QueryFn
    state_query: QueryFn
    route: str = "/bi/painel"
    context_filters: dict[str, Any] = field(default_factory=dict)
    last_sources: list[YaSource] = field(default_factory=list)
    schema_available: bool = True
    schema_tables: set[str] | None = None


class ToolInputError(ValueError):
    """A validated tool input cannot be safely executed."""


class ToolUnavailable(RuntimeError):
    """The official runtime contract is not available for this request."""


def normalize_funnel_label(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    without_accents = "".join(char for char in normalized if not unicodedata.combining(char))
    return " ".join(without_accents.replace("_", " ").split()).casefold()


def is_repasse(value: str) -> bool:
    normalized = normalize_funnel_label(value)
    return "repasse" in normalized


def funnel_scope(mode: str, selected: list[str]) -> tuple[list[str] | None, list[str]]:
    """Translate the explicit user-facing mode to RPC values.

    ``None`` is deliberate for the default: the current official sales RPC
    owns the default exclusion.  Non-default modes are passed explicitly so
    an installed RPC that cannot express the requested scope is rejected by
    the adapter instead of silently returning another concept.
    """
    warnings: list[str] = []
    if mode == "padrao":
        return None, warnings
    if mode == "selecionados":
        values = [
            "REPASSE DE MAQUINA" if is_repasse(item) else " ".join(item.split())[:120]
            for item in selected
            if item and item.strip()
        ]
        if not values:
            raise ToolInputError("Informe ao menos um funil em funis_selecionados.")
        return list(dict.fromkeys(values)), warnings
    if mode == "somente_repasse":
        return list(KNOWN_REPASSE), warnings
    if mode == "todos":
        # The final list can be replaced by runtime catalog discovery.  This
        # canonical set is kept as an explicit safe fallback for installations
        # that expose the three approved funnels but not a filter-list RPC.
        warnings.append("Incluí os funis canônicos conhecidos, incluindo Repasse de Máquina.")
        return ["VENDAS", "Vendas AP", *KNOWN_REPASSE], warnings
    raise ToolInputError("Modo de funil inválido.")


def decode_payload(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError as error:
            log_event(10, "ai_agent_payload_not_json", error_type=type(error).__name__)
            return value
    return value


def compact_result(value: Any) -> Any:
    encoded = _compact(value)
    serialized = json.dumps(encoded, ensure_ascii=False, default=str)
    while len(serialized) > MAX_TOOL_RESULT_CHARS:
        if isinstance(encoded, dict) and isinstance(encoded.get("rows"), list) and encoded["rows"]:
            encoded["rows"].pop()
        elif isinstance(encoded, dict) and isinstance(encoded.get("series"), list) and encoded["series"]:
            encoded["series"].pop()
        else:
            return {"status": "truncated", "preview": serialized[:MAX_TOOL_RESULT_CHARS]}
        serialized = json.dumps(encoded, ensure_ascii=False, default=str)
    return encoded


def find_value(value: Any, *paths: tuple[str, ...]) -> Any:
    for path in paths:
        current = value
        found = True
        for key in path:
            if not isinstance(current, dict) or key not in current:
                found = False
                break
            current = current[key]
        if found:
            return current
    return None


def first_number(value: Any, *keys: str) -> float | int | None:
    if not isinstance(value, dict):
        return None
    for key in keys:
        number = _number(value.get(key))
        if number is not None:
            return int(number) if number.is_integer() else number
    return None


def list_value(value: Any, *keys: str) -> list[dict[str, Any]]:
    if not isinstance(value, dict):
        return []
    for key in keys:
        candidate = value.get(key)
        if isinstance(candidate, str):
            candidate = decode_payload(candidate)
        if isinstance(candidate, list):
            return [item for item in candidate if isinstance(item, dict)][:MAX_TOOL_ROWS]
    return []


def filters_payload(filters: ToolFilters | dict[str, Any]) -> dict[str, Any]:
    if isinstance(filters, ToolFilters):
        values = filters.model_dump(exclude_none=True)
    else:
        values = {key: value for key, value in filters.items() if value not in (None, "", [])}
    return {key: value for key, value in values.items() if key != "motivo_perda" or value}


def source_for(
    *,
    source_id: str,
    label: str,
    intent: str,
    metric_definitions: list[dict[str, Any]],
    period: dict[str, str] | None,
    filters: dict[str, Any],
    requested_filters: dict[str, Any] | None = None,
    warnings: list[str] | None = None,
    refreshed_at: str | None = None,
    elapsed_ms: int = 0,
    row_count: int = 0,
    cache_hit: bool = False,
    snapshot: bool = False,
    competence: list[str] | None = None,
    lineage_executor: str = "agent_official",
    freshness: dict[str, Any] | None = None,
    funnel_mode: str | None = None,
    comparison: dict[str, Any] | None = None,
) -> YaSource:
    applied_filters = dict(filters)
    applied_scope: dict[str, Any] = {
        "period": period,
        "snapshot": snapshot,
        "filters": applied_filters,
        "timezone": "America/Sao_Paulo",
        "catalog_version": CATALOG_VERSION,
    }
    if competence:
        applied_scope["competencias"] = competence
    if funnel_mode:
        applied_scope["modo_funil"] = funnel_mode
    if comparison:
        applied_scope["comparacao"] = comparison
    return YaSource(
        id=source_id,
        label=label,
        filters=applied_filters,
        requested_filters=requested_filters or {},
        refreshed_at=refreshed_at,
        intent=intent,
        metric_definitions=metric_definitions,
        applied_scope=applied_scope,
        freshness=freshness or {"refreshed_at": refreshed_at, "status": "fonte oficial"},
        lineage={"executor": lineage_executor, "catalog_version": CATALOG_VERSION},
        warnings=list(dict.fromkeys(warnings or [])),
        execution_metrics={
            "elapsed_ms": elapsed_ms,
            "row_count": row_count,
            "cache_hit": cache_hit,
            "catalog_version": CATALOG_VERSION,
        },
    )


def public_source(source: YaSource) -> YaSource:
    """Remove implementation lineage before a v2 source reaches the browser."""
    public_metrics = []
    for metric in source.metric_definitions:
        public_metrics.append({
            key: value
            for key, value in metric.items()
            if key not in {"executor", "dimension_paths", "drilldown"}
        })
    safe_metrics = {
        key: value
        for key, value in source.execution_metrics.items()
        if key not in {"query_hash", "sql", "statement"}
    }
    public_scope = {
        key: value
        for key, value in source.applied_scope.items()
        if key != "catalog_version"
    }
    return source.model_copy(update={"lineage": {}, "metric_definitions": public_metrics, "applied_scope": public_scope, "execution_metrics": safe_metrics})


def table_artifact(title: str, rows: list[dict[str, Any]], source_id: str, columns: list[tuple[str, str]] | None = None) -> AgentArtifact | None:
    safe_rows = [compact_result(row) for row in rows[:MAX_TOOL_ROWS] if isinstance(row, dict)]
    if not safe_rows:
        return None
    if columns is None:
        keys: list[str] = []
        for row in safe_rows:
            if isinstance(row, dict):
                for key in row:
                    if key not in keys:
                        keys.append(key)
        columns = [(key, human_key(key)) for key in keys[:MAX_TOOL_COLUMNS]]
    try:
        return AgentArtifact(
            type="table",
            title=title[:160],
            columns=[ArtifactColumn(key=key, label=label[:120]) for key, label in columns[:MAX_TOOL_COLUMNS]],
            rows=[{key: row.get(key) for key, _ in columns[:MAX_TOOL_COLUMNS]} for row in safe_rows if isinstance(row, dict)],
            source_ids=[source_id],
        )
    except ValueError as error:
        log_event(30, "ai_agent_artifact_rejected", artifact_type="table", error_type=type(error).__name__)
        return None


def kpi_artifact(title: str, values: list[dict[str, Any]], source_id: str) -> AgentArtifact | None:
    if not values:
        return None
    try:
        return AgentArtifact(
            type="kpi_group",
            title=title[:160],
            columns=[ArtifactColumn(key="label", label="Indicador"), ArtifactColumn(key="value", label="Valor"), ArtifactColumn(key="unit", label="Unidade")],
            rows=[{"label": item.get("label"), "value": item.get("value"), "unit": item.get("unit")} for item in values[:12]],
            source_ids=[source_id],
        )
    except ValueError as error:
        log_event(30, "ai_agent_artifact_rejected", artifact_type="kpi_group", error_type=type(error).__name__)
        return None


def chart_artifact(kind: str, title: str, rows: list[dict[str, Any]], source_id: str, x_key: str = "name") -> AgentArtifact | None:
    if kind not in {"bar", "line"} or not rows:
        return None
    series_keys: list[str] = []
    for row in rows:
        for key, value in row.items():
            if key != x_key and _number(value) is not None and key not in series_keys:
                series_keys.append(key)
    if not series_keys:
        return None
    try:
        return AgentArtifact(
            type=kind,
            title=title[:160],
            rows=[compact_result(row) for row in rows[:MAX_TOOL_ROWS]],
            x_key=x_key,
            series=[{"key": key, "label": human_key(key)} for key in series_keys[:12]],
            source_ids=[source_id],
        )
    except ValueError as error:
        log_event(30, "ai_agent_artifact_rejected", artifact_type=kind, error_type=type(error).__name__)
        return None


def human_key(key: str) -> str:
    words = key.replace("_", " ").replace("-", " ")
    output: list[str] = []
    for char in words:
        if char.isupper() and output and output[-1] and output[-1][-1].islower():
            output.append(" ")
        output.append(char)
    return "".join(output).strip().capitalize()


def row_measure(row: dict[str, Any]) -> float | None:
    for key in ("value", "valor", "qtd", "quantidade", "acoes", "visitas", "ganhos", "perdidos", "faturamento"):
        number = _number(row.get(key))
        if number is not None:
            return number
    return None


def row_label(row: dict[str, Any]) -> str:
    return _row_label(row)


def now_elapsed(started: float) -> int:
    return round((time.monotonic() - started) * 1000)
