"""Ceres BI FastAPI gateway; direct, read-only PostgreSQL access."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Annotated
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from auth import CurrentUser, make_bi_user_dependency
from config import Settings
from db import ReadOnlyDatabase
from rpc import fetch_core, fetch_detalhe, fetch_funil, fetch_mapa
from schemas import AcoesDetalheFilters, AcoesFilters, BiEnvelope


logger = logging.getLogger("ceresbi.bi")
settings = Settings.from_env()
database = ReadOnlyDatabase(settings)
require_bi_user = make_bi_user_dependency(settings, database)


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
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


def request_id(request: Request) -> str:
    return request.headers.get("x-request-id") or str(uuid4())


def validate_period(filters: AcoesFilters) -> None:
    # FastAPI's class-based query dependency validates individual fields but
    # does not consistently run model-level validators across versions.
    if filters.from_ and filters.to and filters.from_ > filters.to:
        raise HTTPException(status_code=422, detail="from não pode ser posterior a to")


async def execute_rpc(endpoint: str, call, request: Request) -> BiEnvelope:
    rid = request_id(request)
    try:
        data = await asyncio.to_thread(call)
        return BiEnvelope.success(data, rid)
    except Exception:  # noqa: BLE001 - boundary logs and redacts details
        logger.exception("bi_rpc_failed endpoint=%s request_id=%s", endpoint, rid)
        return BiEnvelope.failure(rid, message="Não foi possível carregar este bloco de dados.")


@app.get("/health")
async def health() -> dict[str, object]:
    database_ok = False
    if database.configured:
        try:
            database_ok = await asyncio.to_thread(database.ping)
        except Exception:  # noqa: BLE001 - health must not leak database details
            logger.exception("bi_health_database_failed")
    return {
        "status": "ok" if database_ok and bool(settings.jwt_secret) else "degraded",
        "service": "ceresbi-bi",
        "databaseConfigured": database.configured,
        "databaseReachable": database_ok,
        "jwtConfigured": bool(settings.jwt_secret),
    }


@app.get("/api/bi/acoes/core", response_model=BiEnvelope)
async def acoes_core(
    request: Request,
    filters: Annotated[AcoesFilters, Query()],
    _: CurrentUser = Depends(require_bi_user),
) -> BiEnvelope:
    validate_period(filters)
    return await execute_rpc("acoes.core", lambda: fetch_core(database, filters), request)


@app.get("/api/bi/acoes/detalhe", response_model=BiEnvelope)
async def acoes_detalhe(
    request: Request,
    filters: Annotated[AcoesDetalheFilters, Query()],
    _: CurrentUser = Depends(require_bi_user),
) -> BiEnvelope:
    validate_period(filters)
    return await execute_rpc("acoes.detalhe", lambda: fetch_detalhe(database, filters), request)


@app.get("/api/bi/acoes/funil", response_model=BiEnvelope)
async def acoes_funil(
    request: Request,
    filters: Annotated[AcoesFilters, Query()],
    _: CurrentUser = Depends(require_bi_user),
) -> BiEnvelope:
    validate_period(filters)
    return await execute_rpc("acoes.funil", lambda: fetch_funil(database, filters), request)


@app.get("/api/bi/acoes/mapa", response_model=BiEnvelope)
async def acoes_mapa(
    request: Request,
    filters: Annotated[AcoesFilters, Query()],
    _: CurrentUser = Depends(require_bi_user),
) -> BiEnvelope:
    validate_period(filters)
    return await execute_rpc("acoes.mapa", lambda: fetch_mapa(database, filters), request)
