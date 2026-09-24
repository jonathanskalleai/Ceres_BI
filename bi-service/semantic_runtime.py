"""Shared execution path for versioned BI semantic queries."""

from __future__ import annotations

import asyncio
import logging
from time import perf_counter
from typing import Any
from uuid import uuid4

from cache import QueryCache, make_cache_key
from config import Settings
from db import ReadOnlyDatabase
from observability import (
    emit_bi_query,
    error_code,
    filter_hash,
    payload_size,
    period_case,
    safe_request_id,
)
from schemas import BiEnvelope, BiMetrics, BiRpcRequest, BiSnapshot
from semantic_snapshots import fetch_semantic_snapshot

LOGGER = logging.getLogger("ceresbi.bi.semantic")


def _request_id(request: Any) -> str:
    return safe_request_id(request.headers.get("x-request-id") or str(uuid4()))


def _envelope_size(envelope: BiEnvelope) -> int:
    return len(envelope.model_dump_json().encode("utf-8"))


async def execute_semantic_rpc(
    request: Any,
    payload: BiRpcRequest,
    args: tuple[Any, ...],
    rpc_name: str,
    dashboard_id: str,
    user: Any,
    database: ReadOnlyDatabase,
    settings: Settings,
    query_cache: QueryCache,
    *,
    snapshot_id: str | None = None,
) -> BiEnvelope:
    """Serve a stable envelope from a snapshot, then DirectQuery as fallback."""

    rid = _request_id(request)
    route_started_at = perf_counter()
    query_started_at = perf_counter()
    cache_key = make_cache_key(
        "semantic.query",
        user.id,
        rpc_name,
        (filter_hash(payload.params),),
    )
    source = "rpc"
    try:
        async def compute() -> tuple[Any, BiSnapshot]:
            nonlocal source
            snapshot = await asyncio.to_thread(
                fetch_semantic_snapshot,
                database,
                snapshot_id or f"rpc.{rpc_name}",
                payload.params,
                settings.read_model_max_age_seconds,
            )
            if snapshot is not None:
                source = "read_model"
                return snapshot
            data = await asyncio.to_thread(
                database.execute_rpc,
                rpc_name,
                args,
            )
            return data, BiSnapshot(model=dashboard_id, status="ready", is_stale=False, source="rpc")

        cached = await query_cache.get_or_compute(cache_key, compute)
        data, snapshot = cached.value
        source = snapshot.source or source
        query_ms = 0.0 if cached.hit else round((perf_counter() - query_started_at) * 1000, 3)
        api_ms = round((perf_counter() - route_started_at) * 1000, 3)
        metrics = BiMetrics(
            query_ms=query_ms,
            api_ms=api_ms,
            payload_bytes=payload_size(data),
            cache_hit=cached.hit,
        )
        response = BiEnvelope.success(data, rid, metrics)
        response.snapshot = snapshot
        metrics.payload_bytes = _envelope_size(response)
        emit_bi_query(
            request_id=rid,
            dashboard_id=dashboard_id,
            route=request.url.path,
            endpoint=f"semantic.{rpc_name}",
            rpc=rpc_name,
            case=period_case(payload.params),
            filters_hash=filter_hash(payload.params),
            status="ok",
            query_ms=query_ms,
            api_ms=api_ms,
            payload_bytes=metrics.payload_bytes,
            cache_hit=cached.hit,
            source=source,
        )
        return response
    except Exception as exc:
        query_ms = round((perf_counter() - query_started_at) * 1000, 3)
        api_ms = round((perf_counter() - route_started_at) * 1000, 3)
        code = error_code(exc)
        LOGGER.exception("bi_semantic_query_failed rpc=%s request_id=%s", rpc_name, rid)
        metrics = BiMetrics(query_ms=query_ms, api_ms=api_ms, payload_bytes=0, cache_hit=False)
        response = BiEnvelope.failure(
            rid,
            message="Não foi possível carregar este bloco de dados.",
            code=code,
            metrics=metrics,
        )
        metrics.payload_bytes = _envelope_size(response)
        emit_bi_query(
            request_id=rid,
            dashboard_id=dashboard_id,
            route=request.url.path,
            endpoint=f"semantic.{rpc_name}",
            rpc=rpc_name,
            case=period_case(payload.params),
            filters_hash=filter_hash(payload.params),
            status="error",
            query_ms=query_ms,
            api_ms=api_ms,
            payload_bytes=metrics.payload_bytes,
            cache_hit=False,
            error_code=code,
        )
        return response
