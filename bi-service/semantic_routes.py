"""Dashboard-oriented semantic endpoints backed by Import/Hybrid snapshots."""

from __future__ import annotations

import asyncio
import logging
from time import perf_counter
from typing import Annotated

from fastapi import APIRouter, Header, Query, Request

from auth import authenticate_bi_user
from cache import QueryCache
from catalog import build_args, get_spec
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
from panel_runtime import execute_panel_kpis
from schemas import BiEnvelope, BiMetrics, BiRpcRequest, BiSnapshot, PanelFilters
from semantic_runtime import execute_semantic_rpc
from semantic_snapshots import fetch_semantic_snapshot

LOGGER = logging.getLogger("ceresbi.bi.semantic.routes")


def create_semantic_router(
    database: ReadOnlyDatabase,
    settings: Settings,
    query_cache: QueryCache,
) -> APIRouter:
    router = APIRouter(prefix="/api/bi/v1")

    @router.post("/desempenho", response_model=BiEnvelope)
    async def desempenho(
        request: Request,
        payload: BiRpcRequest,
        authorization: Annotated[str | None, Header()] = None,
    ) -> BiEnvelope:
        rpc_name = "rpc_desempenho_vendas_bi"
        spec = get_spec(rpc_name)
        user = authenticate_bi_user(authorization, settings, database, spec.modules)
        _, args = build_args(rpc_name, payload.params)
        return await execute_semantic_rpc(
            request,
            payload,
            args,
            rpc_name,
            "bi.desempenho",
            user,
            database,
            settings,
            query_cache,
            snapshot_id="desempenho",
        )

    @router.get("/painel/kpis", response_model=BiEnvelope)
    async def painel(
        request: Request,
        filters: Annotated[PanelFilters, Query()],
        authorization: Annotated[str | None, Header()] = None,
    ) -> BiEnvelope:
        user = authenticate_bi_user(
            authorization,
            settings,
            database,
            ("bi.painel", "bi.comercial", "bi.desempenho", "bi.operacional"),
        )
        values = filters.model_dump(mode="json", by_alias=True, exclude_none=True)
        started_at = perf_counter()
        try:
            snapshot = await asyncio.to_thread(
                fetch_semantic_snapshot,
                database,
                "painel",
                values,
                settings.read_model_max_age_seconds,
            )
            if snapshot is not None:
                data, metadata = snapshot
                elapsed_ms = round((perf_counter() - started_at) * 1000, 3)
                metrics = BiMetrics(
                    query_ms=elapsed_ms,
                    api_ms=elapsed_ms,
                    payload_bytes=payload_size(data),
                    cache_hit=False,
                )
                response = BiEnvelope.success(data, safe_request_id(request.headers.get("x-request-id")), metrics)
                response.snapshot = metadata
                metrics.payload_bytes = len(response.model_dump_json().encode("utf-8"))
                return response

            response = await execute_panel_kpis(request, filters, user, database, query_cache)
            response.snapshot = BiSnapshot(model="painel", status="ready", is_stale=False, source="rpc")
            return response
        except Exception as exc:
            rid = safe_request_id(request.headers.get("x-request-id"))
            elapsed_ms = round((perf_counter() - started_at) * 1000, 3)
            code = error_code(exc)
            LOGGER.exception("bi_semantic_panel_failed request_id=%s", rid)
            response = BiEnvelope.failure(
                rid,
                message="Não foi possível carregar este painel.",
                code=code,
                metrics=BiMetrics(query_ms=elapsed_ms, api_ms=elapsed_ms),
            )
            emit_bi_query(
                request_id=rid,
                dashboard_id="bi.painel",
                route=request.url.path,
                endpoint="semantic.painel.kpis",
                rpc="panel.kpis",
                case=period_case(values),
                filters_hash=filter_hash(values),
                status="error",
                query_ms=elapsed_ms,
                api_ms=elapsed_ms,
                payload_bytes=len(response.model_dump_json().encode("utf-8")),
                cache_hit=False,
                error_code=code,
            )
            return response

    return router
