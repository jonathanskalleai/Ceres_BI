"""Runtime orchestration for the server-composed BI panel contract."""

from __future__ import annotations

import asyncio
from time import perf_counter
from typing import Any

from cache import QueryCache, make_cache_key
from db import ReadOnlyDatabase
from observability import emit_bi_query, filter_hash, period_case, safe_request_id
from panel import compose_panel_kpis
from schemas import BiEnvelope, BiIssue, BiMetrics, PanelFilters


def _previous_period(value: Any) -> Any:
    """Mirror date-fns setFullYear while handling February 29 safely."""

    try:
        return value.replace(year=value.year - 1)
    except ValueError:
        return value.replace(year=value.year - 1, day=28)


async def execute_panel_kpis(
    request: Any,
    filters: PanelFilters,
    user: Any,
    database: ReadOnlyDatabase,
    query_cache: QueryCache,
) -> BiEnvelope:
    route_started_at = perf_counter()
    rid = safe_request_id(request.headers.get("x-request-id"))
    previous_from = _previous_period(filters.from_)
    previous_to = _previous_period(filters.to)
    funis = filters.funis or None

    calls = {
        "negocios.current": ("rpc_negocios_bi", (filters.from_, filters.to, funis, filters.cidade, filters.vendedor)),
        "negocios.previous": ("rpc_negocios_bi", (previous_from, previous_to, funis, filters.cidade, filters.vendedor)),
        "acoes.current": ("rpc_acoes_bi_periodo", (filters.from_, filters.to, filters.vendedor, None, filters.cidade)),
        "acoes.previous": ("rpc_acoes_bi_periodo", (previous_from, previous_to, filters.vendedor, None, filters.cidade)),
        "funil.current": ("rpc_acoes_funil_gestao_periodo", (filters.from_, filters.to, filters.vendedor, filters.cidade)),
        "funil.previous": ("rpc_acoes_funil_gestao_periodo", (previous_from, previous_to, filters.vendedor, filters.cidade)),
        "operacional.current": ("rpc_operacional_bi", ()),
    }

    async def read(label: str, rpc_name: str, args: tuple[Any, ...]) -> tuple[str, Any, float, bool, Exception | None]:
        started_at = perf_counter()
        key = make_cache_key("painel.kpis", user.id, rpc_name, (label, args))
        try:
            cached = await query_cache.get_or_compute(
                key,
                lambda: asyncio.to_thread(database.execute_rpc, rpc_name, args),
            )
            elapsed = 0.0 if cached.hit else round((perf_counter() - started_at) * 1000, 3)
            return label, cached.value, elapsed, cached.hit, None
        except Exception as exc:  # noqa: BLE001 - one failed block becomes a partial envelope
            return label, None, round((perf_counter() - started_at) * 1000, 3), False, exc

    results = await asyncio.gather(*(read(label, rpc, args) for label, (rpc, args) in calls.items()))
    values: dict[str, Any] = {}
    issues: list[BiIssue] = []
    timings: list[float] = []
    cache_hits: list[bool] = []
    for label, value, elapsed, cache_hit, error in results:
        timings.append(elapsed)
        cache_hits.append(cache_hit)
        if error is not None:
            issues.append(BiIssue(
                code="BI_PANEL_SOURCE_FAILED",
                message="Um bloco de indicadores não pôde ser atualizado.",
                source=label,
            ))
            continue
        values[label] = value

    data, missing = compose_panel_kpis(
        values.get("negocios.current"),
        values.get("negocios.previous"),
        values.get("acoes.current"),
        values.get("acoes.previous"),
        values.get("funil.current"),
        values.get("funil.previous"),
        values.get("operacional.current"),
    )
    if missing:
        issues.append(BiIssue(
            code="BI_PANEL_DATA_INCOMPLETE",
            message="Alguns indicadores não possuem dados completos; os campos ausentes não representam zero.",
            source="panel.kpis",
        ))

    status = "partial" if issues else "ok"
    query_ms = round(max(timings, default=0.0), 3)
    api_ms = round((perf_counter() - route_started_at) * 1000, 3)
    metrics = BiMetrics(
        query_ms=query_ms,
        api_ms=api_ms,
        payload_bytes=0,
        cache_hit=bool(cache_hits) and all(cache_hits),
    )
    response = BiEnvelope(
        status=status,
        data=data,
        issues=issues,
        requestId=rid,
        fetchedAt=BiEnvelope.success(None, rid).fetchedAt,
        metrics=metrics,
    )
    metrics.payload_bytes = len(response.model_dump_json().encode("utf-8"))
    emit_bi_query(
        request_id=rid,
        dashboard_id="bi.painel",
        route=request.url.path,
        endpoint="painel.kpis",
        rpc=",".join(rpc for rpc, _ in calls.values()),
        case=period_case(filters),
        filters_hash=filter_hash(filters),
        status=status,
        query_ms=query_ms,
        api_ms=api_ms,
        payload_bytes=metrics.payload_bytes,
        cache_hit=metrics.cache_hit,
        **({"error_code": issues[0].code} if issues else {}),
    )
    return response
