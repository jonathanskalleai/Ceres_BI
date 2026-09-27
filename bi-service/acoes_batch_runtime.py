"""Concurrent Ações blocks with snapshot-first and DirectQuery fallback."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from time import perf_counter
from typing import Any
from uuid import uuid4

from auth import CurrentUser
from cache import QueryCache, make_cache_key
from config import Settings
from db import ReadOnlyDatabase
from fastapi import Request
from observability import (
    emit_bi_query,
    error_code,
    filter_hash,
    period_case,
    rows_returned,
    safe_request_id,
)
from rpc import fetch_core, fetch_funil
from schemas import AcoesFilters, BiEnvelope, BiMetrics
from semantic_snapshots import fetch_semantic_snapshot

LOGGER = logging.getLogger("ceresbi.bi.acoes_batch")


def _request_id(request: Request) -> str:
    return safe_request_id(request.headers.get("x-request-id") or str(uuid4()))


def _envelope_size(envelope: BiEnvelope) -> int:
    return len(envelope.model_dump_json().encode("utf-8"))


async def execute_acoes_batch(
    request: Request,
    filters: AcoesFilters,
    route_started_at: float,
    user: CurrentUser,
    database: ReadOnlyDatabase,
    settings: Settings,
    query_cache: QueryCache,
) -> BiEnvelope:
    """Load core and funnel independently without fabricating failed data."""

    rid = _request_id(request)

    async def run_block(
        block: str,
        rpc_name: str,
        call: Callable[[], Any],
    ) -> tuple[str, Any, tuple[str, str] | None, float, float | None, bool]:
        started_at = perf_counter()
        try:
            snapshot_params: dict[str, Any] = {
                "p_from": filters.from_,
                "p_to": filters.to,
                "p_vendedor": filters.vendedor,
                "p_cidade": filters.cidade,
            }
            if block == "core":
                snapshot_params["p_tipo_acao"] = filters.tipoAcao
            snapshot_started_at = perf_counter()
            snapshot = await asyncio.to_thread(
                fetch_semantic_snapshot,
                database,
                f"rpc.{rpc_name}",
                snapshot_params,
                settings.read_model_max_age_seconds,
            )
            if snapshot is not None:
                return (
                    block,
                    snapshot[0],
                    None,
                    round((perf_counter() - started_at) * 1000, 3),
                    round((perf_counter() - snapshot_started_at) * 1000, 3),
                    False,
                )

            cache_key = make_cache_key("acoes.batch", user.id, rpc_name, (filter_hash(filters),))

            async def compute_block() -> tuple[Any, float]:
                db_started_at = perf_counter()
                value = await asyncio.to_thread(call)
                return value, round((perf_counter() - db_started_at) * 1000, 3)

            cached = await query_cache.get_or_compute(cache_key, compute_block)
            value, measured_db_ms = cached.value
            elapsed_ms = 0.0 if cached.hit else round((perf_counter() - started_at) * 1000, 3)
            return block, value, None, elapsed_ms, (0.0 if cached.hit else measured_db_ms), cached.hit
        except Exception as exc:
            LOGGER.exception("bi_batch_rpc_failed block=%s request_id=%s", block, rid)
            return (
                block,
                None,
                (rpc_name, error_code(exc)),
                round((perf_counter() - started_at) * 1000, 3),
                None,
                False,
            )

    results = await asyncio.gather(
        run_block("core", "rpc_acoes_bi_periodo", lambda: fetch_core(database, filters)),
        run_block("funil", "rpc_acoes_funil_gestao_periodo", lambda: fetch_funil(database, filters)),
    )
    data: dict[str, object] = {}
    issues: list[dict[str, str]] = []
    query_ms = 0.0
    error_codes: list[str] = []
    cache_flags: list[bool] = []
    db_ms = 0.0
    for block, value, failure, elapsed_ms, block_db_ms, block_cache_hit in results:
        query_ms = max(query_ms, elapsed_ms)
        if block_db_ms is not None:
            db_ms = max(db_ms, block_db_ms)
        cache_flags.append(block_cache_hit)
        if failure is None:
            data[block] = value
            continue
        rpc_name, code = failure
        error_codes.append(code)
        issues.append({
            "code": f"BI_BATCH_{block.upper()}_FAILED",
            "message": f"O bloco {block} não pôde ser carregado.",
            "source": rpc_name,
        })

    api_ms = round((perf_counter() - route_started_at) * 1000, 3)
    status = "ok" if len(data) == 2 else ("partial" if data else "error")
    cache_hit = bool(cache_flags) and all(cache_flags)
    metrics = BiMetrics(
        query_ms=query_ms,
        db_ms=db_ms if not cache_hit else 0.0,
        api_ms=api_ms,
        payload_bytes=0,
        rows_returned=rows_returned(data),
        cache_hit=cache_hit,
    )
    if status == "error":
        response = BiEnvelope(
            status="error",
            issues=issues,
            requestId=rid,
            fetchedAt=BiEnvelope.success(None, rid).fetchedAt,
            metrics=metrics,
        )
    elif status == "partial":
        response = BiEnvelope(
            status="partial",
            data=data,
            issues=issues,
            requestId=rid,
            fetchedAt=BiEnvelope.success(None, rid).fetchedAt,
            metrics=metrics,
        )
    else:
        response = BiEnvelope.success(data, rid, metrics)
    metrics.payload_bytes = _envelope_size(response)
    emit_bi_query(
        request_id=rid,
        dashboard_id="bi_acoes",
        route=request.url.path,
        endpoint="acoes.batch",
        rpc="rpc_acoes_bi_periodo,rpc_acoes_funil_gestao_periodo",
        case=period_case(filters),
        filters_hash=filter_hash(filters),
        status=status,
        query_ms=query_ms,
        db_ms=metrics.db_ms,
        api_ms=api_ms,
        payload_bytes=metrics.payload_bytes,
        rows_returned=metrics.rows_returned,
        cache_hit=cache_hit,
        **({"error_code": error_codes[0]} if error_codes else {}),
    )
    return response
