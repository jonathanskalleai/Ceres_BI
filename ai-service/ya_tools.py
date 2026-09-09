"""Closed, deterministic gateway for conversational BI capabilities."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from datetime import datetime
from typing import Any, Callable, Awaitable

from fastapi import HTTPException

from ai_logger import log_event, log_exception
from ya_dynamic_query import DynamicQueryExecutor
from ya_catalog import EXECUTOR_LABELS, EXECUTOR_TABLES, MetricDefinition, get_metric
from ya_db import query_async, query_read_only_async
from ya_models import YaSource
from ya_query_models import PeriodSpec, QuerySpec
from ya_tool_utils import (
    DIMENSION_PATHS,
    MAX_RESULT_ITEMS,
    _compact,
    _metric_row_measure,
    _path,
    _row_count,
    _row_label,
    compare_data,
    pearson,
)
from ya_snapshot_tools import SNAPSHOT_EXECUTORS, execute_snapshot


DATA_CACHE_TTL_SECONDS = int(os.getenv("AI_DATA_CACHE_TTL_SECONDS", "90"))
_cache: dict[str, tuple[float, Any, YaSource]] = {}

QueryFn = Callable[[str, tuple[Any, ...]], Awaitable[list[dict[str, Any]]]]


class ToolGateway:
    def __init__(self, query_fn: QueryFn = query_async, read_only_query_fn: QueryFn = query_read_only_async):
        self._query = query_fn
        self._dynamic = DynamicQueryExecutor(read_only_query_fn)

    async def execute(
        self,
        spec: QuerySpec,
        user_id: str,
        *,
        dynamic_sql: str | None = None,
        known_tables: set[str] | None = None,
    ) -> list[tuple[str, Any, YaSource, bool]]:
        if spec.clarification:
            return []
        if spec.intent in {"conversation", "source"}:
            return []
        freshness = await self._freshness()
        if dynamic_sql:
            return [await self._dynamic.execute(spec, dynamic_sql, user_id, freshness, known_tables)]
        if spec.intent == "get_freshness":
            return [await self._freshness_result(freshness)]
        if spec.intent == "list_filter_values":
            return [await self._filter_values(spec, freshness)]
        if spec.intent == "entity_360":
            return [await self._entity_360(spec, freshness)]
        if spec.intent == "explain_metric":
            return [self._explanation(spec)]
        metric = get_metric(spec.metrics[0]) if spec.metrics else None
        if metric and metric.executor in SNAPSHOT_EXECUTORS:
            return [await execute_snapshot(self._query, spec, freshness)]
        if spec.intent == "correlation":
            return [await self._correlation(spec, freshness)]
        if spec.intent == "compare" and spec.comparison:
            current = await self._execute_period(spec, spec.period, user_id, freshness, "atual")
            baseline = await self._execute_period(spec, spec.comparison.baseline, user_id, freshness, "anterior")
            source = current[2]
            source.warnings = list(dict.fromkeys(source.warnings + baseline[2].warnings))
            source.execution_metrics["comparison"] = baseline[2].execution_metrics
            result = compare_data(current[1], baseline[1], get_metric(spec.metrics[0]) if spec.metrics else None)
            variation = result.get("variation") if isinstance(result, dict) else None
            has_zero_baseline = isinstance(variation, dict) and (
                variation.get("baseline_zero")
                or any(item.get("baseline_zero") for item in variation.get("rows", []) if isinstance(item, dict))
            )
            if has_zero_baseline:
                source.warnings.append("A base do período anterior é zero; a variação percentual não foi calculada.")
            source.preview = _compact(result)
            return [("compare_periods", result, source, current[3] and baseline[3])]
        return [await self._execute_period(spec, spec.period, user_id, freshness, spec.intent)]

    async def _freshness(self) -> dict[str, Any]:
        try:
            rows = await self._query("SELECT MAX(last_sync_at) AS refreshed_at FROM mirror.sync_control WHERE status = 'idle'", ())
            value = rows[0].get("refreshed_at") if rows else None
            refreshed = value.isoformat() if isinstance(value, datetime) else str(value) if value else None
            return {"refreshed_at": refreshed, "status": "known" if refreshed else "unknown"}
        except HTTPException as error:
            log_event(logging.WARNING, "ai_freshness_unavailable", status_code=error.status_code)
            return {"refreshed_at": None, "status": "unavailable"}

    async def _freshness_result(self, freshness: dict[str, Any]) -> tuple[str, Any, YaSource, bool]:
        etl_status: Any = []
        warnings = ["O estado de frescura não foi confirmado."] if freshness["status"] != "known" else []
        try:
            rows = await self._query("SELECT public.rpc_etl_status() AS payload", ())
            etl_status = rows[0].get("payload") if rows else []
        except HTTPException as error:
            log_event(logging.WARNING, "ai_etl_status_unavailable", status_code=error.status_code)
            warnings.append("O detalhamento do ETL não está disponível neste momento.")
        except Exception as error:
            log_exception("ai_etl_status_unexpected_failure", error)
            warnings.append("O detalhamento do ETL não está disponível neste momento.")
        source = YaSource(
            id="mirror.sync_control",
            label="Atualização do mirror",
            intent="get_freshness",
            freshness=freshness,
            lineage={"table": "mirror.sync_control", "executor": "rpc_etl_status", "catalog_version": "operational"},
            warnings=warnings,
            preview={"freshness": freshness, "etl": _compact(etl_status)},
        )
        return "get_freshness", {"freshness": freshness, "etl": _compact(etl_status)}, source, False

    async def _filter_values(self, spec: QuerySpec, freshness: dict[str, Any]) -> tuple[str, Any, YaSource, bool]:
        dimension = spec.dimensions[0] if spec.dimensions else ""
        key_by_dimension = {"vendedor": "vendedores", "cidade": "cidades"}
        raw: dict[str, Any] = {}
        warnings: list[str] = []
        used_rpc = False
        if dimension in key_by_dimension and spec.period:
            used_rpc = True
            rows = await self._query(
                "SELECT public.rpc_listas_filtros(%s::date,%s::date) AS payload",
                (spec.period.from_date.isoformat(), spec.period.to_date.isoformat()),
            )
            payload = rows[0].get("payload") if rows else {}
            raw = payload if isinstance(payload, dict) else {}
            values = raw.get(key_by_dimension[dimension], [])
            if not isinstance(values, list):
                values = []
            data = {"dimension": dimension, "values": [str(item)[:120] for item in values[:MAX_RESULT_ITEMS]]}
        else:
            warnings.append("O contrato atual só fornece valores canônicos de vendedor e cidade.")
            data = {"dimension": dimension or None, "values": []}
        source = YaSource(
            id="semantic_catalog:filter_values",
            label="Catálogo semântico",
            intent=spec.intent,
            requested_filters=spec.requested_filters,
            filters={**spec.filters},
            refreshed_at=freshness.get("refreshed_at"),
            applied_scope={"period": {"from": spec.period.from_date.isoformat(), "to": spec.period.to_date.isoformat()} if spec.period else None, "filters": spec.filters, "filter_origins": spec.filter_origins, "timezone": "America/Sao_Paulo"},
            freshness=freshness,
            lineage={"catalog_version": spec.catalog_version, "executor": "rpc_listas_filtros" if used_rpc else "semantic_catalog", "tables": ["mirror.sync_control"] if used_rpc else []},
            warnings=warnings,
            execution_metrics={"elapsed_ms": 0, "row_count": _row_count(data), "cache_hit": False, "period_label": "filter_values"},
            preview=data,
        )
        return "list_filter_values", data, source, False

    async def _entity_360(self, spec: QuerySpec, freshness: dict[str, Any]) -> tuple[str, Any, YaSource, bool]:
        if not spec.entity or not spec.period:
            raise HTTPException(status_code=422, detail="Informe o cliente e o período para a visão 360")
        raw = await self._raw("client_360", spec, spec.period)
        clients = raw.get("clientes") if isinstance(raw, dict) else None
        warnings: list[str] = []
        if isinstance(clients, list) and len(clients) == 1:
            data = _compact(raw)
        elif isinstance(clients, list) and len(clients) > 1:
            matches = [
                {
                    key: item.get(key)
                    for key in ("cliente", "cidade", "uf", "consultor")
                    if item.get(key)
                }
                for item in clients[:5]
                if isinstance(item, dict)
            ]
            data = {"status": "ambiguous", "matches": matches}
            warnings.append("Mais de um cliente corresponde ao nome informado; refine por cidade ou consultor antes de analisar.")
        else:
            data = {"status": "not_found", "matches": []}
            warnings.append("Nenhum cliente correspondente foi encontrado no cadastro canônico.")
        source = self._source(
            spec,
            None,
            spec.period,
            "entity_360",
            raw,
            freshness,
            0,
            False,
            warnings,
            executor="client_360",
        )
        source.preview = data
        return "get_entity_360", data, source, False

    def _explanation(self, spec: QuerySpec) -> tuple[str, Any, YaSource, bool]:
        metric = get_metric(spec.metrics[0]) if spec.metrics else None
        if not metric:
            raise HTTPException(status_code=422, detail="Informe uma métrica do catálogo para explicar")
        source = self._source(spec, metric, spec.period, "explain_metric", {}, {"status": "catalog"}, 0, False, [])
        data = {"metric": metric.as_dict()}
        source.preview = data
        return "explain_metric", data, source, False

    async def _execute_period(
        self,
        spec: QuerySpec,
        period: PeriodSpec | None,
        user_id: str,
        freshness: dict[str, Any],
        label: str,
    ) -> tuple[str, Any, YaSource, bool]:
        metric = get_metric(spec.metrics[0]) if spec.metrics else None
        if not metric or not period:
            raise HTTPException(status_code=422, detail="A consulta não possui uma métrica e período válidos")
        cache_key = hashlib.sha256(json.dumps({"user": user_id, "spec": spec.model_dump(mode="json"), "period": period.model_dump(mode="json"), "freshness": freshness}, sort_keys=True).encode()).hexdigest()
        cached = _cache.get(cache_key)
        if cached and cached[0] > time.monotonic():
            _, data, source = cached
            copy = source.model_copy(deep=True)
            copy.execution_metrics["cache_hit"] = True
            return label, data, copy, True
        started = time.monotonic()
        raw: Any = {}
        if spec.intent == "drilldown":
            data, drill_warnings = await self._drilldown(spec, metric, period)
            warnings = drill_warnings
        else:
            raw = await self._raw(metric.executor, spec, period)
            data, warnings = self._shape(spec, metric, raw)
        elapsed_ms = round((time.monotonic() - started) * 1000)
        source = self._source(spec, metric, period, label, raw, freshness, elapsed_ms, False, warnings)
        source.execution_metrics["row_count"] = _row_count(data)
        source.preview = _compact(data)
        _cache[cache_key] = (time.monotonic() + DATA_CACHE_TTL_SECONDS, data, source.model_copy(deep=True))
        self._trim_cache()
        return label, data, source, False

    async def _raw(self, executor: str, spec: QuerySpec, period: PeriodSpec) -> Any:
        f = spec.filters
        p_from, p_to = period.from_date.isoformat(), period.to_date.isoformat()
        if executor == "sales_overview":
            params = (p_from, p_to, None, f.get("vendedor"), f.get("cidade"), f.get("condicao"), f.get("produto"), f.get("origem"), f.get("banco"), f.get("motivo_perda"), f.get("funis"))
            rows = await self._query("SELECT public.rpc_desempenho_vendas_bi(%s::date,%s::date,%s::integer,%s,%s,%s,%s,%s,%s,%s,%s::text[]) AS payload", params)
        elif executor == "business_analysis":
            rows = await self._query("SELECT public.rpc_negocios_bi(%s::date,%s::date,%s::text[],%s,%s) AS payload", (p_from, p_to, f.get("funis"), f.get("cidade"), f.get("vendedor")))
        elif executor == "funnel":
            rows = await self._query("SELECT public.rpc_acoes_funil_gestao_periodo(%s::date,%s::date,%s,%s) AS payload", (p_from, p_to, f.get("vendedor"), f.get("cidade")))
        elif executor == "orders":
            rows = await self._query("SELECT public.rpc_pedidos_bi(%s::date,%s::date,%s,%s) AS payload", (p_from, p_to, f.get("cidade"), f.get("vendedor")))
        elif executor == "after_sales":
            rows = await self._query("SELECT public.rpc_servicos_bi(%s::date,%s::date,%s) AS payload", (p_from, p_to, f.get("cidade")))
        elif executor == "client_360":
            entity = (spec.entity or {}).get("name")
            if not entity:
                raise HTTPException(status_code=422, detail="Informe o cliente para a visão 360")
            rows = await self._query("SELECT public.rpc_ya_cliente_360(%s,%s::date,%s::date) AS payload", (entity, p_from, p_to))
        else:
            raise HTTPException(status_code=422, detail="Executor de dados não reconhecido")
        return rows[0].get("payload") if rows else {}

    def _shape(self, spec: QuerySpec, metric: MetricDefinition, raw: Any) -> tuple[Any, list[str]]:
        warnings: list[str] = []
        if spec.intent in {"breakdown", "compare"} and spec.dimensions:
            path = (metric.dimension_paths or {}).get(spec.dimensions[0]) if spec.dimensions else None
            path = path or (DIMENSION_PATHS.get(metric.executor, {}).get(spec.dimensions[0]) if spec.dimensions else None)
            rows = _path(raw, path) if path else None
            if not isinstance(rows, list):
                warnings.append("A dimensão solicitada não tem bloco nomeado no contrato vigente.")
                rows = []
            ordered_rows = [row for row in rows if isinstance(row, dict)]
            if spec.order_by == "name_asc":
                ordered_rows.sort(key=lambda row: _row_label(row).casefold())
            elif spec.order_by == "value_asc":
                ordered_rows.sort(key=lambda row: _metric_row_measure(metric, row) if _metric_row_measure(metric, row) is not None else float("inf"))
            else:
                ordered_rows.sort(key=lambda row: _metric_row_measure(metric, row) if _metric_row_measure(metric, row) is not None else float("-inf"), reverse=True)
            return {"dimension": spec.dimensions[0] if spec.dimensions else None, "rows": _compact(ordered_rows[:spec.limit])}, warnings
        if spec.intent == "timeseries":
            series = _path(raw, metric.series_path) if metric.series_path else None
            if not isinstance(series, list):
                warnings.append("A série temporal não está disponível neste contrato.")
                series = []
            return {"metric": metric.id, "series": _compact(series[:MAX_RESULT_ITEMS])}, warnings
        if spec.intent == "drilldown":
            return {"metric": metric.id, "rows": []}, warnings
        value = _path(raw, metric.value_path)
        if value is None:
            warnings.append("O contrato não retornou o valor solicitado.")
        return {"metric": metric.id, "label": metric.label, "value": value, "unit": metric.unit}, warnings

    async def _drilldown(self, spec: QuerySpec, metric: MetricDefinition, period: PeriodSpec) -> tuple[Any, list[str]]:
        f = spec.filters
        if metric.domain != "acoes":
            return {"metric": metric.id, "rows": []}, [
                "Esta métrica ainda não possui um contrato de detalhe da mesma coorte; o agregado não foi convertido em lista."
            ]
        params_base = (period.from_date.isoformat(), period.to_date.isoformat(), f.get("vendedor"), f.get("cidade"), spec.limit, 0)
        if metric.drilldown_kind == "pedidos_ganhos":
            rows = await self._query("SELECT public.rpc_acoes_pedidos_ganhos(%s::date,%s::date,%s,%s,%s,%s,%s::text[]) AS payload", params_base + (f.get("funis"),))
            return _compact(rows[0].get("payload", {})) if rows else {}, []
        if metric.drilldown_kind == "negocios_perdidos":
            rows = await self._query("SELECT public.rpc_acoes_negocios_perdidos(%s::date,%s::date,%s,%s,%s,%s,%s::text[]) AS payload", params_base + (f.get("funis"),))
            return _compact(rows[0].get("payload", {})) if rows else {}, []
        return {"rows": [], "total": 0}, ["Esta métrica ainda não possui um contrato de detalhe aprovado; o agregado não foi convertido em lista."]

    async def _correlation(self, spec: QuerySpec, freshness: dict[str, Any]) -> tuple[str, Any, YaSource, bool]:
        first = get_metric(spec.metrics[0]) if spec.metrics else None
        second = get_metric(spec.metrics[1]) if len(spec.metrics) > 1 else None
        if not first or not second or first.executor != second.executor or not spec.dimensions:
            source = self._source(spec, first or second, spec.period, "correlate", {}, freshness, 0, False, ["As medidas não compartilham executor e grão compatíveis."])
            return "correlate", {"status": "blocked", "reason": "coorte_incompatível", "n": 0}, source, False
        current = await self._raw(first.executor, spec, spec.period) if spec.period else {}
        first_rows = self._dimension_rows(first, spec.dimensions[0], current)
        second_rows = self._dimension_rows(second, spec.dimensions[0], current)
        index = {_row_label(row): row for row in second_rows if isinstance(row, dict)}
        pairs = []
        for row in first_rows:
            if not isinstance(row, dict):
                continue
            other = index.get(_row_label(row))
            x = _metric_row_measure(first, row)
            y = _metric_row_measure(second, other or {})
            if x is not None and y is not None:
                pairs.append((x, y))
        coefficient = pearson(pairs)
        warnings = [] if len(pairs) >= 3 and coefficient is not None else ["A amostra pareada é insuficiente ou constante; nenhuma associação foi calculada."]
        result = {
            "status": "computed" if coefficient is not None else "insufficient_sample",
            "method": "Pearson",
            "n": len(pairs),
            "coefficient": coefficient,
            "association_only": True,
        }
        source = self._source(spec, first, spec.period, "correlate", {}, freshness, 0, False, warnings)
        source.execution_metrics["row_count"] = len(pairs)
        source.preview = result
        return "correlate", result, source, False

    def _dimension_rows(self, metric: MetricDefinition, dimension: str, raw: Any) -> list[Any]:
        path = (metric.dimension_paths or {}).get(dimension) or DIMENSION_PATHS.get(metric.executor, {}).get(dimension)
        rows = _path(raw, path) if path else []
        return rows if isinstance(rows, list) else []

    def _source(
        self,
        spec: QuerySpec,
        metric: MetricDefinition | None,
        period: PeriodSpec | None,
        label: str,
        raw: Any,
        freshness: dict[str, Any],
        elapsed_ms: int,
        cache_hit: bool,
        warnings: list[str],
        *,
        executor: str | None = None,
    ) -> YaSource:
        metric_defs = [get_metric(item).as_dict() for item in spec.metrics if get_metric(item)]
        filters = {**spec.filters}
        if period:
            filters = {"from": period.from_date.isoformat(), "to": period.to_date.isoformat(), **filters}
        if isinstance(raw, dict) and isinstance(raw.get("rows"), list):
            row_count = len(raw["rows"])
        elif isinstance(raw, dict) and isinstance(raw.get("clientes"), list):
            row_count = len(raw["clientes"])
        else:
            row_count = 1
        ref = f"{metric.id}:{filters.get('from')}:{filters.get('to')}" if metric and metric.drilldown_kind else None
        return YaSource(
            id=f"{label}:{metric.id if metric else 'operational'}:{filters.get('from', 'none')}:{filters.get('to', 'none')}",
            label=EXECUTOR_LABELS.get(executor or (metric.executor if metric else ""), "Catálogo semântico"),
            filters=filters,
            refreshed_at=freshness.get("refreshed_at"),
            intent=spec.intent,
            requested_filters=spec.requested_filters,
            metric_definitions=metric_defs,
            applied_scope={"period": filters.get("from") and {"from": filters.get("from"), "to": filters.get("to")}, "filters": {key: value for key, value in filters.items() if key not in {"from", "to"}}, "filter_origins": spec.filter_origins, "timezone": period.timezone if period else "America/Sao_Paulo"},
            freshness=freshness,
            lineage={"executor": executor or (metric.executor if metric else "mirror.sync_control"), "tables": EXECUTOR_TABLES.get(executor or (metric.executor if metric else ""), []), "metric_ids": spec.metrics, "catalog_version": spec.catalog_version},
            warnings=list(dict.fromkeys([*spec.warnings, *warnings])),
            drilldown_ref=ref,
            execution_metrics={"elapsed_ms": elapsed_ms, "row_count": row_count, "cache_hit": cache_hit, "period_label": label},
        )

    def _trim_cache(self) -> None:
        if len(_cache) <= 500:
            return
        now = time.monotonic()
        for key, item in list(_cache.items()):
            if item[0] <= now:
                _cache.pop(key, None)
