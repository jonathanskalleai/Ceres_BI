"""HTTP surface for the v2 conversational BI agent.

The runner lives in `ya_agent_runner` so transport, orchestration and
persistence remain independently testable.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from typing import Any, AsyncIterator

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from ai_logger import log_event, log_exception
from auth import AuthenticatedBIUser
from ya_agent_models import AgentTurnResult
from ya_agent_prompt import PROMPT_VERSION
from ya_agent_runner import AgentRunner
from ya_agent_support import ensure_rate_limit, result_payload, sse
from ya_agent_tools import TOOL_DEFINITIONS
from ya_catalog import CATALOG_VERSION
from ya_db import database_health, query_async
from ya_memory import forget_user_memory, load_user_memories
from ya_models import YaChatRequest
from ya_provider import provider_health


router = APIRouter(prefix="/ai/v2", tags=["ai-agent-v2"])
V2_ENABLED = os.getenv("YA_AGENT_V2_ENABLED", "false").casefold() in {"1", "true", "yes", "on"}


@router.get("/health")
async def agent_health() -> dict[str, Any]:
    return {
        "process": "ok",
        "enabled": V2_ENABLED,
        "provider": provider_health(),
        "database": database_health(),
        "catalog_version": CATALOG_VERSION,
        "prompt_version": PROMPT_VERSION,
        "tool_count": len(TOOL_DEFINITIONS),
    }


@router.get("/memories")
async def memories(user: AuthenticatedBIUser, limit: int = Query(default=24, ge=1, le=50)):
    _ensure_enabled()
    return await load_user_memories(query_async, user.id, limit)


@router.delete("/memories/{memory_key}")
async def forget_memory(memory_key: str, user: AuthenticatedBIUser):
    _ensure_enabled()
    try:
        return await forget_user_memory(query_async, user_id=user.id, memory_key=memory_key)
    except ValueError as error:
        log_event(logging.WARNING, "ai_agent_memory_key_invalid", error_type=type(error).__name__)
        raise HTTPException(status_code=422, detail="Memória inválida") from error


@router.post("/chat")
async def agent_chat(request: YaChatRequest, user: AuthenticatedBIUser):
    _ensure_enabled()
    ensure_rate_limit(user.id, time.monotonic())
    result = await AgentRunner().run(request, user)
    return result_payload(result)


@router.post("/chat/stream")
async def agent_chat_stream(request: YaChatRequest, user: AuthenticatedBIUser) -> StreamingResponse:
    _ensure_enabled()
    ensure_rate_limit(user.id, time.monotonic())
    queue: asyncio.Queue[tuple[str | None, dict[str, Any] | BaseException | None]] = asyncio.Queue()

    async def emit(event: str, data: dict[str, Any]) -> None:
        await queue.put((event, data))

    async def work() -> None:
        try:
            result = await AgentRunner().run(request, user, on_event=emit)
            await queue.put(("__done__", {"result": result}))
        except BaseException as error:
            log_event(logging.ERROR, "ai_agent_worker_failed", error_type=type(error).__name__)
            await queue.put(("__error__", error))

    task = asyncio.create_task(work())

    async def generate() -> AsyncIterator[str]:
        try:
            while True:
                event, data = await queue.get()
                if event == "__done__":
                    result = data.get("result") if isinstance(data, dict) else None
                    if isinstance(result, AgentTurnResult):
                        yield sse("done", result_payload(result))
                    break
                if event == "__error__":
                    error = data if isinstance(data, BaseException) else RuntimeError("agent failure")
                    if isinstance(error, HTTPException):
                        detail = error.detail if isinstance(error.detail, str) else "Não foi possível concluir esta consulta."
                    else:
                        log_exception("ai_agent_stream_failed", error)
                        detail = "Não consegui concluir esta consulta agora. Tente reformular a pergunta ou reduzir o recorte."
                    yield sse("error", {"detail": detail, "trace_id": str(uuid.uuid4())})
                    break
                if event:
                    yield sse(event, data if isinstance(data, dict) else {})
        except asyncio.CancelledError:
            task.cancel()
            raise
        finally:
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
                except Exception as error:
                    log_exception("ai_agent_stream_task_cleanup_failed", error)

    return StreamingResponse(generate(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


def _ensure_enabled() -> None:
    if not V2_ENABLED:
        raise HTTPException(status_code=404, detail="Agente v2 desativada neste ambiente")


__all__ = ["AgentRunner", "router"]
