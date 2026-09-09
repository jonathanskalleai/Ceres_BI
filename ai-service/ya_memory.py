"""Conversation persistence and structured investigation memory."""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Awaitable, Callable, Optional

from fastapi import HTTPException

from ai_logger import log_event
from ya_models import ConversationDetail, ConversationMessage, ConversationPreview, YaContext, YaSource


THREAD_HISTORY_MESSAGES = 8
THREAD_SUMMARY_MAX_CHARS = 3_200
QueryFn = Callable[[str, tuple[Any, ...]], Awaitable[list[dict[str, Any]]]]


@dataclass
class ThreadMemory:
    summary: str
    state: dict[str, Any]
    history: list[dict[str, str]]
    last_sources: list[YaSource]


def json_default(value: Any) -> str:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    return str(value)


def iso(value: Any) -> str:
    return value.isoformat() if isinstance(value, datetime) else str(value)


def _json_value(value: Any, fallback: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError as error:
            log_event(logging.WARNING, "ai_memory_invalid_json", error_type=type(error).__name__)
            return fallback
    return value if value is not None else fallback


def sources_from_db(value: Any) -> list[YaSource]:
    raw = _json_value(value, [])
    if not isinstance(raw, list):
        return []
    sources: list[YaSource] = []
    for item in raw:
        try:
            sources.append(YaSource.model_validate(item))
        except (TypeError, ValueError) as error:
            log_event(logging.WARNING, "ai_memory_invalid_source", error_type=type(error).__name__)
    return sources


async def ensure_conversation(query: QueryFn, conversation_id: Optional[str], user_id: str, context: YaContext, message: str) -> str:
    if conversation_id:
        try:
            parsed_id = str(uuid.UUID(conversation_id))
        except ValueError as error:
            raise HTTPException(status_code=422, detail="Identificador de conversa inválido") from error
        rows = await query("SELECT id::text FROM public.ya_chat_conversations WHERE id = %s::uuid AND user_id = %s::uuid AND status = 'active'", (parsed_id, user_id))
        if not rows:
            raise HTTPException(status_code=404, detail="Conversa não encontrada ou encerrada")
        return parsed_id
    title = " ".join(message.split())[:80]
    rows = await query(
        """INSERT INTO public.ya_chat_conversations (user_id, title, last_context, status, summary, conversation_state)
           VALUES (%s::uuid, %s, %s::jsonb, 'active', '', '{}'::jsonb) RETURNING id::text""",
        (user_id, title, json.dumps(context.model_dump(by_alias=True), default=json_default)),
    )
    return str(rows[0]["id"])


async def load_thread_memory(query: QueryFn, conversation_id: str, user_id: str) -> ThreadMemory:
    summary_rows = await query(
        "SELECT COALESCE(summary, '') AS summary, COALESCE(conversation_state, '{}'::jsonb) AS conversation_state FROM public.ya_chat_conversations WHERE id = %s::uuid AND user_id = %s::uuid",
        (conversation_id, user_id),
    )
    if not summary_rows:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    rows = await query(
        "SELECT role, content FROM public.ya_chat_messages WHERE conversation_id = %s::uuid ORDER BY created_at DESC LIMIT %s",
        (conversation_id, THREAD_HISTORY_MESSAGES),
    )
    state = _json_value(summary_rows[0].get("conversation_state"), {})
    last_rows = await query(
        "SELECT sources, evidence FROM public.ya_chat_messages WHERE conversation_id = %s::uuid AND role = 'assistant' ORDER BY created_at DESC LIMIT 1",
        (conversation_id,),
    )
    last_sources = sources_from_db(last_rows[0].get("evidence")) if last_rows else []
    if not last_sources and last_rows:
        last_sources = sources_from_db(last_rows[0].get("sources"))
    if not last_sources and isinstance(state, dict):
        last_sources = sources_from_db(state.get("last_sources"))
    return ThreadMemory(
        summary=str(summary_rows[0].get("summary") or ""),
        state=state if isinstance(state, dict) else {},
        history=[{"role": row["role"], "content": row["content"]} for row in reversed(rows)],
        last_sources=last_sources,
    )


async def persist_message(query: QueryFn, conversation_id: str, role: str, content: str, query_spec: dict[str, Any], evidence: list[YaSource]) -> str:
    encoded = json.dumps([item.model_dump() for item in evidence], default=json_default)
    rows = await query(
        """INSERT INTO public.ya_chat_messages (conversation_id, role, content, sources, query_spec, evidence)
           VALUES (%s::uuid, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb) RETURNING id::text""",
        (conversation_id, role, content, encoded, json.dumps(query_spec, default=json_default), encoded),
    )
    return str(rows[0]["id"])


def next_summary(previous: str, message: str, answer: str, context: YaContext) -> str:
    filters = context.filters.model_dump(by_alias=True, exclude_none=True)
    context_note = ", ".join(f"{key}={value}" for key, value in filters.items()) or "filtros da tela"
    fragment = f"\n- Pergunta: {message[:420]}\n  Resposta: {answer[:720]}\n  Contexto: {context_note}"
    return (previous.strip() + fragment)[-THREAD_SUMMARY_MAX_CHARS:]


async def update_state(query: QueryFn, conversation_id: str, previous: str, message: str, answer: str, context: YaContext, query_spec: dict[str, Any], evidence: list[YaSource]) -> dict[str, Any]:
    previous_state = await query("SELECT COALESCE(conversation_state, '{}'::jsonb) AS conversation_state FROM public.ya_chat_conversations WHERE id = %s::uuid", (conversation_id,))
    old = _json_value(previous_state[0].get("conversation_state"), {}) if previous_state else {}
    state = dict(old) if isinstance(old, dict) else {}
    state.update({
        "last_query_spec": query_spec,
        "last_cohort": [item.applied_scope for item in evidence if item.applied_scope],
        "last_metrics": query_spec.get("metrics", []),
        "last_entity": query_spec.get("entity"),
        "last_drilldown_ref": next((item.drilldown_ref for item in evidence if item.drilldown_ref), None),
        "last_question": message[:500],
        "last_answer": answer[:800],
        "last_sources": [item.model_dump(exclude={"preview"}) for item in evidence] or state.get("last_sources", []),
        "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    })
    await query(
        "UPDATE public.ya_chat_conversations SET summary = %s, summary_updated_at = NOW(), last_context = %s::jsonb, conversation_state = %s::jsonb WHERE id = %s::uuid",
        (next_summary(previous, message, answer, context), json.dumps(context.model_dump(by_alias=True), default=json_default), json.dumps(state, default=json_default), conversation_id),
    )
    return state


async def persist_tool_run(query: QueryFn, conversation_id: str, message_id: str, name: str, query_spec: dict[str, Any], source: YaSource) -> None:
    metrics = source.execution_metrics
    await query(
        """INSERT INTO public.ya_chat_tool_runs
           (conversation_id, message_id, tool_name, filters, elapsed_ms, intent, tool_version, query_spec,
            applied_scope, metric_definitions, freshness, lineage, warnings, drilldown_ref, row_count, cache_hit)
           VALUES (%s::uuid, %s::uuid, %s, %s::jsonb, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb, %s, %s, %s)""",
        (conversation_id, message_id, name, json.dumps(source.filters, default=json_default), int(metrics.get("elapsed_ms", 0)), source.intent,
         str(source.lineage.get("catalog_version", "")), json.dumps(query_spec, default=json_default), json.dumps(source.applied_scope, default=json_default),
         json.dumps(source.metric_definitions, default=json_default), json.dumps(source.freshness, default=json_default), json.dumps(source.lineage, default=json_default),
         json.dumps(source.warnings, default=json_default), source.drilldown_ref, int(metrics.get("row_count", 0)), bool(metrics.get("cache_hit", False))),
    )


async def persist_turn_metric(query: QueryFn, *, conversation_id: str, message_id: str, route: str, query_spec: dict[str, Any], requested_filters: dict[str, Any], sources: list[YaSource], db_ms: int, model_ms: int, total_ms: int, answer_chars: int, cache_hits: int, row_count: int, status: str) -> None:
    try:
        applied = [source.applied_scope for source in sources]
        freshness = [source.freshness for source in sources]
        await query(
            """INSERT INTO public.ai_chat_turn_metrics
               (conversation_id, message_id, route, db_ms, model_ms, total_ms, cache_hits, source_count, answer_chars, status,
                intent, query_spec, requested_filters, applied_filters, freshness, tool_names, warning_count, row_count, drilldown_count)
               VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb, %s, %s, %s)""",
            (conversation_id, message_id, route[:120], db_ms, model_ms, total_ms, cache_hits, len(sources), answer_chars, status,
             query_spec.get("intent", ""), json.dumps(query_spec, default=json_default), json.dumps(requested_filters, default=json_default),
             json.dumps(applied, default=json_default), json.dumps(freshness, default=json_default), json.dumps([source.id for source in sources]),
             sum(len(source.warnings) for source in sources), row_count, sum(bool(source.drilldown_ref) for source in sources)),
        )
    except HTTPException as error:
        log_event(logging.ERROR, "ai_turn_metric_persist_failed", status_code=error.status_code)


async def list_conversations(query: QueryFn, user_id: str, limit: int) -> list[ConversationPreview]:
    rows = await query(
        """SELECT c.id::text, c.title, c.status, c.updated_at,
                  (SELECT MAX(m.created_at) FROM public.ya_chat_messages m WHERE m.conversation_id = c.id) AS last_message_at
           FROM public.ya_chat_conversations c WHERE c.user_id = %s::uuid AND c.status = 'active'
           ORDER BY c.updated_at DESC LIMIT %s""",
        (user_id, limit),
    )
    return [ConversationPreview(id=row["id"], title=row["title"], status=row["status"], updated_at=iso(row["updated_at"]), last_message_at=iso(row["last_message_at"]) if row.get("last_message_at") else None) for row in rows]


async def get_conversation(query: QueryFn, conversation_id: str, user_id: str) -> ConversationDetail:
    try:
        parsed_id = str(uuid.UUID(conversation_id))
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Identificador de conversa inválido") from error
    rows = await query("SELECT id::text, title, status, COALESCE(summary, '') AS summary, COALESCE(conversation_state, '{}'::jsonb) AS conversation_state, updated_at FROM public.ya_chat_conversations WHERE id = %s::uuid AND user_id = %s::uuid", (parsed_id, user_id))
    if not rows:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    messages = await query("SELECT id::text, role, content, sources, query_spec, evidence, created_at FROM public.ya_chat_messages WHERE conversation_id = %s::uuid ORDER BY created_at ASC LIMIT 120", (parsed_id,))
    conversation = rows[0]
    state = _json_value(conversation.get("conversation_state"), {})
    return ConversationDetail(
        id=conversation["id"], title=conversation["title"], status=conversation["status"], summary=conversation["summary"],
        conversation_state=state if isinstance(state, dict) else {}, updated_at=iso(conversation["updated_at"]),
        messages=[ConversationMessage(id=row["id"], role=row["role"], content=row["content"], sources=sources_from_db(row.get("sources")), query_spec=_json_value(row.get("query_spec"), {}), evidence=sources_from_db(row.get("evidence")), created_at=iso(row["created_at"])) for row in messages],
    )


async def close_conversation(query: QueryFn, conversation_id: str, user_id: str) -> dict[str, str]:
    try:
        parsed_id = str(uuid.UUID(conversation_id))
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Identificador de conversa inválido") from error
    rows = await query("UPDATE public.ya_chat_conversations SET status = 'closed', closed_at = NOW() WHERE id = %s::uuid AND user_id = %s::uuid AND status = 'active' RETURNING id::text", (parsed_id, user_id))
    if not rows:
        raise HTTPException(status_code=404, detail="Conversa não encontrada ou já encerrada")
    return {"id": rows[0]["id"], "status": "closed"}


async def persist_feedback(
    query: QueryFn,
    conversation_id: str,
    message_id: str,
    user_id: str,
    feedback_type: str,
) -> dict[str, str]:
    try:
        parsed_conversation_id = str(uuid.UUID(conversation_id))
        parsed_message_id = str(uuid.UUID(message_id))
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Identificador de feedback inválido") from error
    rows = await query(
        """UPDATE public.ai_chat_turn_metrics metric
           SET feedback_type = %s
           FROM public.ya_chat_conversations conversation
           WHERE metric.message_id = %s::uuid
             AND metric.conversation_id = conversation.id
             AND conversation.id = %s::uuid
             AND conversation.user_id = %s::uuid
           RETURNING metric.id::text""",
        (feedback_type, parsed_message_id, parsed_conversation_id, user_id),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Nenhum turno disponível para receber feedback")
    log_event(logging.INFO, "ai_turn_feedback_recorded", feedback_type=feedback_type)
    return {"status": "recorded"}
