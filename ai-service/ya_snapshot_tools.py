"""Read-only adapters for existing snapshot BI RPCs."""

from __future__ import annotations

import time
from typing import Any, Awaitable, Callable

from ya_catalog import EXECUTOR_LABELS, get_metric
from ya_models import YaSource
from ya_query_models import QuerySpec
from ya_tool_utils import _compact, _metric_row_measure, _path, _row_count, _row_label


SNAPSHOT_EXECUTORS = frozenset({"products_snapshot", "admin_snapshot", "operational_snapshot"})
QueryFn = Callable[[str, tuple[Any, ...]], Awaitable[list[dict[str, Any]]]]
SNAPSHOT_SQL = {
    "products_snapshot": "SELECT public.rpc_produtos_bi() AS payload",
    "admin_snapshot": "SELECT public.rpc_admin_bi() AS payload",
    "operational_snapshot": "SELECT public.rpc_operacional_bi() AS payload",
}


def _snapshot_source(
    spec: QuerySpec,
    metric: Any,
    raw: Any,
    freshness: dict[str, Any],
    elapsed_ms: int,
    warnings: list[str],
    row_count: int,
) -> YaSource:
    return YaSource(
        id=f"snapshot:{metric.id}",
        label=EXECUTOR_LABELS.get(metric.executor, "Snapshot BI"),
        filters={},
        requested_filters=spec.requested_filters,
        refreshed_at=freshness.get("refreshed_at"),
        intent=spec.intent,
        metric_definitions=[metric.as_dict()],
        applied_scope={
            "period": None,
            "snapshot": True,
            "filters": {},
            "filter_origins": spec.filter_origins,
            "timezone": "America/Sao_Paulo",
        },
        freshness=freshness,
        lineage={
            "executor": metric.executor,
            "metric_ids": spec.metrics,
            "catalog_version": spec.catalog_version,
            "temporal_mode": "snapshot",
        },
        warnings=list(dict.fromkeys([*spec.warnings, *warnings])),
        execution_metrics={"elapsed_ms": elapsed_ms, "row_count": row_count, "cache_hit": False, "period_label": "snapshot"},
        preview=_compact(raw),
    )


def _shape_snapshot(spec: QuerySpec, metric: Any, raw: Any) -> tuple[Any, list[str]]:
    warnings: list[str] = []
    if spec.intent == "breakdown" and spec.dimensions:
        path = (metric.dimension_paths or {}).get(spec.dimensions[0])
        rows = _path(raw, path) if path else None
        if not isinstance(rows, list):
            return {"dimension": spec.dimensions[0], "rows": []}, [
                "A dimensão solicitada não tem bloco nomeado no snapshot vigente."
            ]
        ordered = [row for row in rows if isinstance(row, dict)]
        if spec.order_by == "name_asc":
            ordered.sort(key=lambda row: _row_label(row).casefold())
        elif spec.order_by == "value_asc":
            ordered.sort(key=lambda row: _metric_row_measure(metric, row) if _metric_row_measure(metric, row) is not None else float("inf"))
        else:
            ordered.sort(key=lambda row: _metric_row_measure(metric, row) if _metric_row_measure(metric, row) is not None else float("-inf"), reverse=True)
        return {"dimension": spec.dimensions[0], "rows": _compact(ordered[:spec.limit])}, warnings
    value = _path(raw, metric.value_path)
    if value is None:
        warnings.append("O snapshot não retornou o valor solicitado.")
    return {"metric": metric.id, "label": metric.label, "value": value, "unit": metric.unit}, warnings


async def execute_snapshot(query_fn: QueryFn, spec: QuerySpec, freshness: dict[str, Any]) -> tuple[str, Any, YaSource, bool]:
    metric = get_metric(spec.metrics[0]) if spec.metrics else None
    if not metric or metric.executor not in SNAPSHOT_EXECUTORS:
        raise ValueError("Executor de snapshot não reconhecido")
    started = time.monotonic()
    rows = await query_fn(SNAPSHOT_SQL[metric.executor], ())
    raw = rows[0].get("payload") if rows else {}
    raw = raw if isinstance(raw, dict) else {}
    data, warnings = _shape_snapshot(spec, metric, raw)
    warnings.insert(0, "Esta fonte é um snapshot atual; não há período histórico ou comparação temporal neste contrato.")
    source = _snapshot_source(spec, metric, raw, freshness, round((time.monotonic() - started) * 1000), warnings, _row_count(data))
    source.preview = _compact(data)
    return ("get_breakdown" if spec.intent == "breakdown" else "get_metric"), data, source, False
