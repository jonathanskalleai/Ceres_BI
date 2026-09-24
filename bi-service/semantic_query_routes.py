"""Generic versioned semantic endpoint for every catalogued BI RPC."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Header, Request

from auth import authenticate_bi_user
from cache import QueryCache
from catalog import build_args, get_spec
from config import Settings
from db import ReadOnlyDatabase
from schemas import BiEnvelope, BiRpcRequest
from semantic_runtime import execute_semantic_rpc


def create_semantic_query_router(
    database: ReadOnlyDatabase,
    settings: Settings,
    query_cache: QueryCache,
) -> APIRouter:
    router = APIRouter(prefix="/api/bi/v1")

    @router.post("/query/{rpc_name}", response_model=BiEnvelope)
    async def query(
        request: Request,
        rpc_name: str,
        payload: BiRpcRequest,
        authorization: Annotated[str | None, Header()] = None,
    ) -> BiEnvelope:
        spec = get_spec(rpc_name)
        user = authenticate_bi_user(authorization, settings, database, spec.modules)
        _, args = build_args(rpc_name, payload.params)
        return await execute_semantic_rpc(
            request,
            payload,
            args,
            rpc_name,
            spec.modules[0],
            user,
            database,
            settings,
            query_cache,
            snapshot_id=f"rpc.{rpc_name}",
        )

    return router
