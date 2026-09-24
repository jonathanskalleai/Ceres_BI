"""Protected HTTP routes for physical dashboard read models."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from time import perf_counter
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from psycopg2 import Error as PsycopgError

from auth import CurrentUser
from db import ReadOnlyDatabase
from observability import emit_bi_query, filter_hash, payload_size, safe_request_id
from read_models import fetch_read_model, fetch_read_model_status
from schemas import BiEnvelope, BiIssue, BiMetrics, ReadModelFilters

logger = logging.getLogger("ceresbi.bi.read_models")


def create_read_model_router(
    database: ReadOnlyDatabase,
    require_user: Callable[..., CurrentUser],
) -> APIRouter:
    router = APIRouter()

    @router.get("/api/bi/model-status", response_model=BiEnvelope)
    async def model_status(
        request: Request,
        user: CurrentUser = Depends(require_user),  # noqa: B008
    ) -> BiEnvelope:
        del user
        request_id = safe_request_id(request.headers.get("x-request-id") or str(uuid4()))
        started_at = perf_counter()
        try:
            data = await asyncio.to_thread(fetch_read_model_status, database)
            elapsed_ms = round((perf_counter() - started_at) * 1000, 3)
            metrics = BiMetrics(query_ms=elapsed_ms, api_ms=elapsed_ms, cache_hit=False)
            degraded = data.get("status") != "ready"
            response = BiEnvelope(
                status="partial" if degraded else "ok",
                data=data,
                issues=(
                    [BiIssue(
                        code="BI_READ_MODEL_DEGRADED",
                        message="Um ou mais read models estão atrasados ou divergentes.",
                        source="bi.refresh_manifest",
                    )]
                    if degraded
                    else []
                ),
                requestId=request_id,
                fetchedAt=BiEnvelope.success(data, request_id).fetchedAt,
                metrics=metrics,
            )
            metrics.payload_bytes = len(response.model_dump_json().encode("utf-8"))
            return response
        except (PsycopgError, RuntimeError, ValueError):
            logger.exception("bi_read_model_status_failed request_id=%s", request_id)
            elapsed_ms = round((perf_counter() - started_at) * 1000, 3)
            return BiEnvelope.failure(
                request_id,
                message="Não foi possível consultar o estado dos read models.",
                code="BI_READ_MODEL_STATUS_FAILED",
                metrics=BiMetrics(query_ms=elapsed_ms, api_ms=elapsed_ms),
            )

    @router.get("/api/bi/models/{model_name}", response_model=BiEnvelope)
    async def read_model(
        request: Request,
        model_name: str,
        filters: Annotated[ReadModelFilters, Query()],
        user: CurrentUser = Depends(require_user),  # noqa: B008
    ) -> BiEnvelope:
        del user
        started_at = perf_counter()
        request_id = safe_request_id(request.headers.get("x-request-id") or str(uuid4()))
        try:
            data = await asyncio.to_thread(
                fetch_read_model,
                database,
                model_name,
                filters.from_,
                filters.to,
                filters.vendedor,
                filters.cidade,
                filters.limit,
                filters.offset,
            )
            elapsed_ms = round((perf_counter() - started_at) * 1000, 3)
            metrics = BiMetrics(
                query_ms=elapsed_ms,
                api_ms=elapsed_ms,
                payload_bytes=payload_size(data),
                cache_hit=False,
            )
            has_more = bool(data.get("pagination", {}).get("has_more"))
            issues: list[BiIssue] = []
            manifest = data.get("manifest")
            if isinstance(manifest, dict):
                if manifest.get("status") != "ready":
                    issues.append(BiIssue(
                        code="BI_READ_MODEL_NOT_READY",
                        message="O snapshot consultado está desatualizado ou em refresh.",
                        source=model_name,
                    ))
                source_from = manifest.get("source_from")
                source_to = manifest.get("source_to")
                if source_from and source_to and (
                    filters.from_ < source_from or filters.to > source_to
                ):
                    issues.append(BiIssue(
                        code="BI_READ_MODEL_OUTSIDE_COVERAGE",
                        message="O período solicitado excede a janela publicada deste snapshot.",
                        source=model_name,
                    ))
            response = BiEnvelope(
                status="partial" if has_more or issues else "ok",
                data=data,
                issues=issues + ([BiIssue(
                    code="BI_READ_MODEL_TRUNCATED",
                    message="Resultado limitado; use offset para carregar a próxima página.",
                    source=model_name,
                )] if has_more else []),
                requestId=request_id,
                fetchedAt=BiEnvelope.success(data, request_id).fetchedAt,
                metrics=metrics,
            )
            metrics.payload_bytes = len(response.model_dump_json().encode("utf-8"))
            emit_bi_query(
                request_id=request_id,
                dashboard_id="bi_read_model",
                route=request.url.path,
                endpoint=f"model.{model_name}",
                rpc="bi.refresh_read_models",
                case="read_model",
                filters_hash=filter_hash(filters),
                status=response.status,
                query_ms=elapsed_ms,
                api_ms=elapsed_ms,
                payload_bytes=metrics.payload_bytes,
                cache_hit=False,
            )
            return response
        except HTTPException:
            raise
        except (PsycopgError, RuntimeError, ValueError) as exc:
            logger.exception("bi_read_model_failed model=%s request_id=%s", model_name, request_id)
            elapsed_ms = round((perf_counter() - started_at) * 1000, 3)
            response = BiEnvelope.failure(
                request_id,
                message="Não foi possível carregar o read model.",
                code="BI_READ_MODEL_FAILED",
                metrics=BiMetrics(query_ms=elapsed_ms, api_ms=elapsed_ms),
            )
            emit_bi_query(
                request_id=request_id,
                dashboard_id="bi_read_model",
                route=request.url.path,
                endpoint=f"model.{model_name}",
                rpc="bi.refresh_read_models",
                case="read_model",
                filters_hash=filter_hash(filters),
                status="error",
                query_ms=elapsed_ms,
                api_ms=elapsed_ms,
                payload_bytes=len(response.model_dump_json().encode("utf-8")),
                cache_hit=False,
                error_code=type(exc).__name__,
            )
            return response

    return router
