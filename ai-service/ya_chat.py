"""Conversational BI API: planning, deterministic execution and SSE delivery."""

from __future__ import annotations

import json
import logging
import time
from collections import defaultdict, deque
from datetime import datetime
from typing import Any, AsyncIterator

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from ai_logger import log_event, log_exception
from auth import AuthenticatedBIUser, CurrentUser
from ya_memory import (
    close_conversation,
    ensure_conversation,
    get_conversation,
    list_conversations,
    load_thread_memory,
    persist_feedback,
    persist_message,
    persist_tool_run,
    persist_turn_metric,
    update_state,
)
from ya_models import FeedbackRequest, PreparedTurn, YaChatRequest, YaChatResponse, YaSource
from ya_prompts import answer_messages, planner_messages
from ya_provider import complete, parse_json_object, stream
from ya_semantics import QueryValidationError, build_query_spec
from ya_tools import ToolGateway, query_async


router = APIRouter(prefix="/ai", tags=["ai-chat"])
REQUEST_LIMIT = 12
REQUEST_WINDOW_SECONDS = 10 * 60
_request_windows: dict[str, deque[float]] = defaultdict(deque)
_gateway = ToolGateway()


def _check_rate_limit(user_id: str) -> None:
    now = time.monotonic()
    window = _request_windows[user_id]
    while window and window[0] <= now - REQUEST_WINDOW_SECONDS:
        window.popleft()
    if len(window) >= REQUEST_LIMIT:
        raise HTTPException(status_code=429, detail="Limite temporário de perguntas atingido. Tente novamente em alguns minutos.")
    window.append(now)


async def _plan_query(request: YaChatRequest, state: dict[str, Any]) -> dict[str, Any]:
    try:
        response = await complete(
            planner_messages(request.message, request, state),
            temperature=0.0,
            max_tokens=650,
            json_mode=True,
        )
        return parse_json_object(response) or {}
    except HTTPException as error:
        log_event(logging.WARNING, "ai_planner_fallback", status_code=error.status_code)
        return {}
    except Exception as error:
        log_exception("ai_planner_unexpected_failure", error)
        return {}


def _fallback_spec(request: YaChatRequest, state: dict[str, Any]):
    return build_query_spec(
        request.message,
        route=request.context.route,
        context_filters=request.context.filters,
        memory_state=state,
        planned={},
    )


async def _prepare_turn(request: YaChatRequest, user: CurrentUser) -> PreparedTurn:
    message = " ".join(request.message.split())
    if not message:
        raise HTTPException(status_code=422, detail="Informe uma pergunta para a AI")
    conversation_id = await ensure_conversation(query_async, request.conversation_id, user.id, request.context, message)
    memory = await load_thread_memory(query_async, conversation_id, user.id)
    proposed = await _plan_query(request, memory.state)
    try:
        spec = build_query_spec(
            message,
            route=request.context.route,
            context_filters=request.context.filters,
            memory_state=memory.state,
            planned=proposed,
        )
    except QueryValidationError as error:
        log_event(logging.WARNING, "ai_query_plan_rejected", error=str(error)[:200])
        spec = _fallback_spec(request, memory.state)
    spec_dict = spec.model_dump(mode="json", by_alias=True)
    user_message_id = await persist_message(query_async, conversation_id, "user", message, spec_dict, [])
    if spec.clarification:
        return PreparedTurn(
            conversation_id=conversation_id,
            user_message_id=user_message_id,
            history=memory.history,
            summary=memory.summary,
            conversation_state=memory.state,
            query_spec=spec_dict,
            sources=[],
            executed=[],
            answer_override=spec.clarification,
            db_ms=0,
            cache_hits=0,
            row_count=0,
        )
    started = time.monotonic()
    results = await _gateway.execute(spec, user.id)
    sources: list[YaSource] = []
    executed: list[dict[str, Any]] = []
    cache_hits = 0
    row_count = 0
    for name, data, source, cache_hit in results:
        sources.append(source)
        executed.append({"tool": name, "data": data})
        cache_hits += int(cache_hit)
        row_count += int(source.execution_metrics.get("row_count", 0))
        await persist_tool_run(query_async, conversation_id, user_message_id, name, spec_dict, source)
    return PreparedTurn(
        conversation_id=conversation_id,
        user_message_id=user_message_id,
        history=memory.history,
        summary=memory.summary,
        conversation_state=memory.state,
        query_spec=spec_dict,
        sources=sources,
        executed=executed,
        answer_override=None,
        db_ms=round((time.monotonic() - started) * 1000),
        cache_hits=cache_hits,
        row_count=row_count,
    )


async def _finalize_turn(
    request: YaChatRequest,
    prepared: PreparedTurn,
    answer: str,
    *,
    model_ms: int,
    total_ms: int,
) -> YaChatResponse:
    normalized = answer.strip() or "Não encontrei dados suficientes para responder com segurança."
    assistant_message_id = await persist_message(
        query_async,
        prepared.conversation_id,
        "assistant",
        normalized,
        prepared.query_spec,
        prepared.sources,
    )
    await update_state(
        query_async,
        prepared.conversation_id,
        prepared.summary,
        request.message,
        normalized,
        request.context,
        prepared.query_spec,
        prepared.sources,
    )
    await persist_turn_metric(
        query_async,
        conversation_id=prepared.conversation_id,
        message_id=assistant_message_id,
        route=request.context.route,
        query_spec=prepared.query_spec,
        requested_filters=prepared.query_spec.get("requested_filters", {}),
        sources=prepared.sources,
        db_ms=prepared.db_ms,
        model_ms=model_ms,
        total_ms=total_ms,
        answer_chars=len(normalized),
        cache_hits=prepared.cache_hits,
        row_count=prepared.row_count,
        status="completed",
    )
    return YaChatResponse(
        conversation_id=prepared.conversation_id,
        assistant_message_id=assistant_message_id,
        answer=normalized,
        sources=prepared.sources,
        evidence=prepared.sources,
        query_spec=prepared.query_spec,
        generated_at=datetime.utcnow().isoformat() + "Z",
    )


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


@router.get("/conversations", response_model=list)
async def conversations(user: AuthenticatedBIUser, limit: int = Query(default=12, ge=1, le=30)):
    return await list_conversations(query_async, user.id, limit)


@router.get("/conversations/{conversation_id}")
async def conversation(conversation_id: str, user: AuthenticatedBIUser):
    return await get_conversation(query_async, conversation_id, user.id)


@router.post("/conversations/{conversation_id}/close")
async def close(conversation_id: str, user: AuthenticatedBIUser) -> dict[str, str]:
    return await close_conversation(query_async, conversation_id, user.id)


@router.post("/conversations/{conversation_id}/messages/{message_id}/feedback")
async def feedback(
    conversation_id: str,
    message_id: str,
    request: FeedbackRequest,
    user: AuthenticatedBIUser,
) -> dict[str, str]:
    try:
        return await persist_feedback(query_async, conversation_id, message_id, user.id, request.feedback_type)
    except HTTPException as error:
        log_event(logging.WARNING, "ai_feedback_request_rejected", status_code=error.status_code)
        raise
    except Exception as error:
        log_exception("ai_feedback_persist_failed", error)
        raise HTTPException(status_code=503, detail="Não foi possível registrar o feedback") from error


@router.post("/ya/chat", response_model=YaChatResponse, include_in_schema=False)
@router.post("/chat", response_model=YaChatResponse)
async def chat(request: YaChatRequest, user: AuthenticatedBIUser) -> YaChatResponse:
    _check_rate_limit(user.id)
    started = time.monotonic()
    try:
        prepared = await _prepare_turn(request, user)
        if prepared.answer_override:
            return await _finalize_turn(request, prepared, prepared.answer_override, model_ms=0, total_ms=round((time.monotonic() - started) * 1000))
        model_started = time.monotonic()
        answer = await complete(answer_messages(request, prepared), temperature=0.2, max_tokens=800, session_id=prepared.conversation_id)
        return await _finalize_turn(request, prepared, answer, model_ms=round((time.monotonic() - model_started) * 1000), total_ms=round((time.monotonic() - started) * 1000))
    except HTTPException as error:
        log_event(logging.WARNING, "ai_chat_request_failed", status_code=error.status_code)
        raise
    except Exception as error:
        log_exception("ai_chat_unexpected_failure", error)
        raise HTTPException(status_code=503, detail="Não foi possível concluir a análise agora.") from error


@router.post("/chat/stream")
async def chat_stream(request: YaChatRequest, user: AuthenticatedBIUser) -> StreamingResponse:
    _check_rate_limit(user.id)

    async def generate() -> AsyncIterator[str]:
        started = time.monotonic()
        prepared: PreparedTurn | None = None
        try:
            yield _sse("status", {"message": "Entendendo o recorte da pergunta…"})
            prepared = await _prepare_turn(request, user)
            yield _sse("thread", {"conversation_id": prepared.conversation_id})
            yield _sse("plan", {"query_spec": prepared.query_spec})
            yield _sse("sources", {"sources": [source.model_dump() for source in prepared.sources], "db_ms": prepared.db_ms, "cache_hits": prepared.cache_hits})
            if prepared.answer_override:
                yield _sse("status", {"message": "Preciso confirmar um detalhe do recorte…"})
                answer = prepared.answer_override
                model_ms = 0
                yield _sse("delta", {"text": answer})
            else:
                status = "Calculando a comparação…" if prepared.query_spec.get("intent") in {"compare", "correlation"} else "Consultando os contratos aprovados…"
                yield _sse("status", {"message": status})
                answer_parts: list[str] = []
                model_started = time.monotonic()
                async for delta in stream(answer_messages(request, prepared), session_id=prepared.conversation_id):
                    answer_parts.append(delta)
                    yield _sse("delta", {"text": delta})
                answer = "".join(answer_parts)
                model_ms = round((time.monotonic() - model_started) * 1000)
            result = await _finalize_turn(request, prepared, answer, model_ms=model_ms, total_ms=round((time.monotonic() - started) * 1000))
            yield _sse("done", {"conversation_id": result.conversation_id, "assistant_message_id": result.assistant_message_id, "answer": result.answer, "sources": [source.model_dump() for source in result.sources], "evidence": [source.model_dump() for source in result.evidence], "query_spec": result.query_spec, "generated_at": result.generated_at})
        except HTTPException as error:
            if prepared:
                await persist_turn_metric(query_async, conversation_id=prepared.conversation_id, message_id=prepared.user_message_id, route=request.context.route, query_spec=prepared.query_spec, requested_filters=prepared.query_spec.get("requested_filters", {}), sources=prepared.sources, db_ms=prepared.db_ms, model_ms=0, total_ms=round((time.monotonic() - started) * 1000), answer_chars=0, cache_hits=prepared.cache_hits, row_count=prepared.row_count, status="failed")
            log_event(logging.WARNING, "ai_chat_request_failed", status_code=error.status_code)
            yield _sse("error", {"detail": error.detail})
        except Exception as error:
            if prepared:
                await persist_turn_metric(query_async, conversation_id=prepared.conversation_id, message_id=prepared.user_message_id, route=request.context.route, query_spec=prepared.query_spec, requested_filters=prepared.query_spec.get("requested_filters", {}), sources=prepared.sources, db_ms=prepared.db_ms, model_ms=0, total_ms=round((time.monotonic() - started) * 1000), answer_chars=0, cache_hits=prepared.cache_hits, row_count=prepared.row_count, status="failed")
            log_exception("ai_chat_stream_unexpected_failure", error)
            yield _sse("error", {"detail": "Não foi possível concluir a análise agora."})

    return StreamingResponse(generate(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
