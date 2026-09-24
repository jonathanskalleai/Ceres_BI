"""Ceres BI FastAPI gateway; direct, read-only PostgreSQL access."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from time import perf_counter
from typing import Annotated
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from auth import CurrentUser, authenticate_bi_user, make_bi_user_dependency
from cache import QueryCache, make_cache_key
from catalog import build_args, get_spec
from config import Settings
from db import ReadOnlyDatabase
from logging_config import configure_application_logging
from observability import (
    emit_bi_query,
    error_code,
    filter_hash,
    payload_size,
    period_case,
    safe_request_id,
)
from panel_runtime import execute_panel_kpis
from read_model_routes import create_read_model_router
from read_models import fetch_read_model_health
from rpc import fetch_core, fetch_detalhe, fetch_funil, fetch_mapa
from schemas import (
    AcoesDetalheFilters,
    AcoesFilters,
    BiEnvelope,
    BiMetrics,
    BiRpcRequest,
    PanelFilters,
)

configure_application_logging()
logger = logging.getLogger("ceresbi.bi")
settings = Settings.from_env()
database = ReadOnlyDatabase(settings)
query_cache = QueryCache(
    settings.cache_max_items,
    settings.cache_ttl_seconds,
    settings.cache_max_entry_bytes,
)
require_bi_user = make_bi_user_dependency(settings, database)
require_panel_user = make_bi_user_dependency(
    settings,
    database,
    ("bi.painel", "bi.comercial", "bi.desempenho", "bi.operacional"),
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    database.start()
    try:
        yield
    finally:
        database.close()


app = FastAPI(title="Ceres BI API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)
app.include_router(create_read_model_router(database, require_bi_user))


def request_id(request: Request) -> str:
    return safe_request_id(request.headers.get("x-request-id") or str(uuid4()))


def validate_period(filters: AcoesFilters) -> None:
    # FastAPI's class-based query dependency validates individual fields but
    # does not consistently run model-level validators across versions.
    if filters.from_ and filters.to and filters.from_ > filters.to:
        raise HTTPException(status_code=422, detail="from não pode ser posterior a to")


def envelope_size(envelope: BiEnvelope) -> int:
    return len(envelope.model_dump_json().encode("utf-8"))


async def execute_rpc(
    endpoint: str,
    rpc_name: str,
    call,
    request: Request,
    filters: object,
    route_started_at: float,
    *,
    dashboard_id: str = "bi_acoes",
    user: CurrentUser | None = None,
    cacheable: bool = True,
) -> BiEnvelope:
    rid = request_id(request)
    query_started_at = perf_counter()
    cache_hit = False
    try:
        async def compute():
            return await asyncio.to_thread(call)

        if cacheable and user is not None:
            cache_key = make_cache_key(endpoint, user.id, rpc_name, (filter_hash(filters),))
            cached = await query_cache.get_or_compute(cache_key, compute)
            data = cached.value
            cache_hit = cached.hit
        else:
            data = await compute()
        query_ms = 0.0 if cache_hit else round((perf_counter() - query_started_at) * 1000, 3)
        api_ms = round((perf_counter() - route_started_at) * 1000, 3)
        metrics = BiMetrics(
            query_ms=query_ms,
            api_ms=api_ms,
            payload_bytes=payload_size(data),
            cache_hit=cache_hit,
        )
        response = BiEnvelope.success(data, rid, metrics)
        metrics.payload_bytes = envelope_size(response)
        emit_bi_query(
            request_id=rid,
            dashboard_id=dashboard_id,
            route=request.url.path,
            endpoint=endpoint,
            rpc=rpc_name,
            case=period_case(filters),
            filters_hash=filter_hash(filters),
            status="ok",
            query_ms=query_ms,
            api_ms=api_ms,
            payload_bytes=metrics.payload_bytes,
            cache_hit=cache_hit,
        )
        return response

    except Exception as exc:
        query_ms = round((perf_counter() - query_started_at) * 1000, 3)
        api_ms = round((perf_counter() - route_started_at) * 1000, 3)
        code = error_code(exc)
        metrics = BiMetrics(query_ms=query_ms, api_ms=api_ms, payload_bytes=0, cache_hit=cache_hit)
        logger.exception("bi_rpc_failed endpoint=%s request_id=%s", endpoint, rid)
        response = BiEnvelope.failure(
            rid,
            message="Não foi possível carregar este bloco de dados.",
            code=code,
            metrics=metrics,
        )
        metrics.payload_bytes = envelope_size(response)
        emit_bi_query(
            request_id=rid,
            dashboard_id=dashboard_id,
            route=request.url.path,
            endpoint=endpoint,
            rpc=rpc_name,
            case=period_case(filters),
            filters_hash=filter_hash(filters),
            status="error",
            query_ms=query_ms,
            api_ms=api_ms,
            payload_bytes=metrics.payload_bytes,
            cache_hit=cache_hit,
            error_code=code,
        )
        return response


async def execute_acoes_batch(
    request: Request,
    filters: AcoesFilters,
    route_started_at: float,
    user: CurrentUser,
) -> BiEnvelope:
    """Run the two primary Ações blocks concurrently with one API round trip.

    The blocks intentionally remain independent: a failure in one RPC does not
    turn the successful block into a fabricated empty value.  The response
    contains only blocks that actually completed and reports the missing ones
    through the stable envelope issues list.
    """

    rid = request_id(request)
    async def run_block(block: str, rpc_name: str, call):
        started_at = perf_counter()
        try:
            cache_key = make_cache_key("acoes.batch", user.id, rpc_name, (filter_hash(filters),))
            cached = await query_cache.get_or_compute(cache_key, lambda: asyncio.to_thread(call))
            elapsed_ms = 0.0 if cached.hit else round((perf_counter() - started_at) * 1000, 3)
            return block, cached.value, None, elapsed_ms, cached.hit
        except Exception as exc:
            logger.exception("bi_batch_rpc_failed block=%s request_id=%s", block, rid)
            return block, None, (rpc_name, error_code(exc)), round((perf_counter() - started_at) * 1000, 3), False

    results = await asyncio.gather(
        run_block("core", "rpc_acoes_bi_periodo", lambda: fetch_core(database, filters)),
        run_block("funil", "rpc_acoes_funil_gestao_periodo", lambda: fetch_funil(database, filters)),
    )
    data: dict[str, object] = {}
    issues = []
    query_ms = 0.0
    error_codes: list[str] = []
    cache_hit = False
    for block, value, failure, elapsed_ms, block_cache_hit in results:
        query_ms = max(query_ms, elapsed_ms)
        cache_hit = cache_hit or block_cache_hit
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
    metrics = BiMetrics(query_ms=query_ms, api_ms=api_ms, payload_bytes=0, cache_hit=cache_hit)
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
    metrics.payload_bytes = envelope_size(response)
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
        api_ms=api_ms,
        payload_bytes=metrics.payload_bytes,
        cache_hit=cache_hit,
        **({"error_code": error_codes[0]} if error_codes else {}),
    )
    return response


@app.get("/health")
@app.get("/api/bi/health")
async def health() -> dict[str, object]:
    database_ok = False
    read_model_health: dict[str, object] = {"status": "unknown"}
    if database.configured:
        try:
            database_ok = await asyncio.to_thread(database.ping)
        except Exception:
            logger.exception("bi_health_database_failed")
        if database_ok:
            try:
                read_model_health = await asyncio.to_thread(
                    fetch_read_model_health,
                    database,
                    settings.read_model_max_age_seconds,
                )
            except Exception:
                logger.exception("bi_health_read_models_failed")
                read_model_health = {"status": "degraded", "staleModels": ["unknown"]}
    service_ok = database_ok and bool(settings.jwt_secret) and read_model_health.get("status") in {"ready", "unknown"}
    return {
        "status": "ok" if service_ok else "degraded",
        "service": "ceresbi-bi",
        "databaseConfigured": database.configured,
        "databaseReachable": database_ok,
        "jwtConfigured": bool(settings.jwt_secret),
        "readModels": read_model_health,
    }


@app.get("/api/bi/painel/kpis", response_model=BiEnvelope)
async def painel_kpis(
    request: Request,
    filters: Annotated[PanelFilters, Query()],
    user: CurrentUser = Depends(require_panel_user),  # noqa: B008
) -> BiEnvelope:
    """Return current/previous panel KPIs composed outside the browser."""

    return await execute_panel_kpis(request, filters, user, database, query_cache)


@app.get("/api/bi/acoes/core", response_model=BiEnvelope)
async def acoes_core(
    request: Request,
    filters: Annotated[AcoesFilters, Query()],
    user: CurrentUser = Depends(require_bi_user),  # noqa: B008
) -> BiEnvelope:
    route_started_at = perf_counter()
    validate_period(filters)
    return await execute_rpc(
        "acoes.core", "rpc_acoes_bi_periodo", lambda: fetch_core(database, filters), request, filters, route_started_at,
        user=user,
    )


@app.get("/api/bi/acoes/batch", response_model=BiEnvelope)
async def acoes_batch(
    request: Request,
    filters: Annotated[AcoesFilters, Query()],
    user: CurrentUser = Depends(require_bi_user),  # noqa: B008
) -> BiEnvelope:
    route_started_at = perf_counter()
    validate_period(filters)
    return await execute_acoes_batch(request, filters, route_started_at, user)


@app.get("/api/bi/acoes/detalhe", response_model=BiEnvelope)
async def acoes_detalhe(
    request: Request,
    filters: Annotated[AcoesDetalheFilters, Query()],
    user: CurrentUser = Depends(require_bi_user),  # noqa: B008
) -> BiEnvelope:
    route_started_at = perf_counter()
    validate_period(filters)
    return await execute_rpc(
        "acoes.detalhe", "rpc_acoes_detalhe", lambda: fetch_detalhe(database, filters), request, filters, route_started_at,
        user=user,
    )


@app.get("/api/bi/acoes/funil", response_model=BiEnvelope)
async def acoes_funil(
    request: Request,
    filters: Annotated[AcoesFilters, Query()],
    user: CurrentUser = Depends(require_bi_user),  # noqa: B008
) -> BiEnvelope:
    route_started_at = perf_counter()
    validate_period(filters)
    return await execute_rpc(
        "acoes.funil", "rpc_acoes_funil_gestao_periodo", lambda: fetch_funil(database, filters), request, filters, route_started_at,
        user=user,
    )


@app.get("/api/bi/acoes/mapa", response_model=BiEnvelope)
async def acoes_mapa(
    request: Request,
    filters: Annotated[AcoesFilters, Query()],
    user: CurrentUser = Depends(require_bi_user),  # noqa: B008
) -> BiEnvelope:
    route_started_at = perf_counter()
    validate_period(filters)
    return await execute_rpc(
        "acoes.mapa", "rpc_acoes_mapa_oportunidades", lambda: fetch_mapa(database, filters), request, filters, route_started_at,
        user=user,
    )


@app.post("/api/bi/rpc/{rpc_name}", response_model=BiEnvelope)
async def bi_rpc(
    request: Request,
    rpc_name: str,
    payload: BiRpcRequest,
    authorization: Annotated[str | None, Header()] = None,
) -> BiEnvelope:
    """Execute an allow-listed RPC with server-side auth, timeout and DB access."""

    spec = get_spec(rpc_name)
    user = authenticate_bi_user(authorization, settings, database, spec.modules)
    _, args = build_args(rpc_name, payload.params)
    route_started_at = perf_counter()
    return await execute_rpc(
        f"rpc.{rpc_name}",
        rpc_name,
        lambda: database.execute_rpc(rpc_name, args),
        request,
        payload.params,
        route_started_at,
        dashboard_id=spec.modules[0],
        user=user,
        cacheable=rpc_name not in {"rpc_etl_status", "rpc_etl_log"},
    )
