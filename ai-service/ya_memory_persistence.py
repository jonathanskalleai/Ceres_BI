"""Persistence adapters kept separate from conversational memory assembly."""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

from fastapi import HTTPException

from ai_logger import log_event
from ya_memory_shared import QueryFn, _json_value, iso, json_default, sources_from_db
from ya_models import ConversationDetail, ConversationMessage, ConversationPreview, YaSource


async def persist_tool_run(
    query: QueryFn,
    conversation_id: str,
    message_id: str,
    name: str,
    query_spec: dict[str, Any],
    source: YaSource,
    *,
    tool_call_id: str | None = None,
    tool_input: dict[str, Any] | None = None,
    result_preview: Any = None,
    presentation: dict[str, Any] | None = None,
) -> None:
    metrics = source.execution_metrics
    base_values = (
        conversation_id, message_id, name, json.dumps(source.filters, default=json_default),
        int(metrics.get("elapsed_ms", 0)), source.intent, str(source.lineage.get("catalog_version", "")),
        json.dumps(query_spec, default=json_default), json.dumps(source.applied_scope, default=json_default),
        json.dumps(source.metric_definitions, default=json_default), json.dumps(source.freshness, default=json_default),
        json.dumps(source.lineage, default=json_default), json.dumps(source.warnings, default=json_default), source.drilldown_ref,
        int(metrics.get("row_count", 0)), bool(metrics.get("cache_hit", False)),
    )
    try:
        await query(
            """INSERT INTO public.ya_chat_tool_runs
               (conversation_id, message_id, tool_name, filters, elapsed_ms, intent, tool_version, query_spec,
                applied_scope, metric_definitions, freshness, lineage, warnings, drilldown_ref, row_count, cache_hit,
                tool_call_id, tool_input, result_preview, presentation)
               VALUES (%s::uuid, %s::uuid, %s, %s::jsonb, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb,
                       %s::jsonb, %s::jsonb, %s::jsonb, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb)""",
            base_values + (
                tool_call_id,
                json.dumps(tool_input or {}, default=json_default),
                json.dumps(result_preview if result_preview is not None else {}, default=json_default),
                json.dumps(presentation or {}, default=json_default),
            ),
        )
    except HTTPException as error:
        log_event(logging.WARNING, "ai_tool_trace_extended_columns_unavailable", status_code=error.status_code)
        await query(
            """INSERT INTO public.ya_chat_tool_runs
               (conversation_id, message_id, tool_name, filters, elapsed_ms, intent, tool_version, query_spec,
                applied_scope, metric_definitions, freshness, lineage, warnings, drilldown_ref, row_count, cache_hit)
               VALUES (%s::uuid, %s::uuid, %s, %s::jsonb, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb,
                       %s::jsonb, %s::jsonb, %s::jsonb, %s, %s, %s)""",
            base_values,
        )


async def persist_agent_tool_run(
    query: QueryFn,
    *,
    conversation_id: str,
    message_id: str,
    tool_name: str,
    tool_call_id: str,
    tool_input: dict[str, Any],
    result_preview: dict[str, Any],
    presentation: dict[str, Any],
    query_spec: dict[str, Any] | None = None,
    source: YaSource | None,
    elapsed_ms: int,
    status: str,
    error_category: str | None = None,
    started_at: str | None = None,
    completed_at: str | None = None,
) -> None:
    """Persist an auditable tool run, with a compatibility fallback."""
    safe_source = source or YaSource(id=f"tool:{tool_call_id}", label=tool_name)
    metrics = safe_source.execution_metrics
    try:
        await query(
            """INSERT INTO public.ya_chat_tool_runs
                 (conversation_id, message_id, tool_name, filters, elapsed_ms, intent, tool_version, query_spec,
                  applied_scope, metric_definitions, freshness, lineage, warnings, drilldown_ref, row_count, cache_hit,
                  tool_call_id, tool_input, result_preview, presentation, status, error_category, started_at, completed_at)
               VALUES (%s::uuid, %s::uuid, %s, %s::jsonb, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb,
                       %s::jsonb, %s::jsonb, %s::jsonb, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb,
                       %s, %s, %s::timestamptz, %s::timestamptz)""",
            (
                conversation_id, message_id, tool_name, json.dumps(safe_source.filters, default=json_default), elapsed_ms,
                safe_source.intent, "v2", json.dumps(query_spec or {"tool": tool_name}, default=json_default),
                json.dumps(safe_source.applied_scope, default=json_default), json.dumps(safe_source.metric_definitions, default=json_default),
                json.dumps(safe_source.freshness, default=json_default), json.dumps(safe_source.lineage, default=json_default),
                json.dumps(safe_source.warnings, default=json_default), safe_source.drilldown_ref, int(metrics.get("row_count", 0)), bool(metrics.get("cache_hit", False)),
                tool_call_id, json.dumps(tool_input, default=json_default), json.dumps(result_preview, default=json_default), json.dumps(presentation, default=json_default),
                status, error_category, started_at, completed_at,
            ),
        )
    except HTTPException as error:
        log_event(logging.WARNING, "ai_agent_tool_trace_fallback", status_code=error.status_code)
        if source:
            try:
                await persist_tool_run(query, conversation_id, message_id, tool_name, query_spec or {"tool": tool_name}, source, tool_call_id=tool_call_id, tool_input=tool_input, result_preview=result_preview, presentation=presentation)
            except HTTPException as fallback_error:
                log_event(logging.WARNING, "ai_agent_tool_trace_minimal_fallback", status_code=fallback_error.status_code)
        else:
            await query(
                """INSERT INTO public.ya_chat_tool_runs (conversation_id, message_id, tool_name, filters, elapsed_ms)
                   VALUES (%s::uuid, %s::uuid, %s, %s::jsonb, %s)""",
                (conversation_id, message_id, tool_name, json.dumps(safe_source.filters, default=json_default), elapsed_ms),
            )


async def persist_agent_turn_metrics(
    query: QueryFn,
    *,
    conversation_id: str,
    message_id: str,
    route: str,
    query_spec: dict[str, Any],
    sources: list[YaSource],
    db_ms: int,
    model_ms: int,
    total_ms: int,
    answer_chars: int,
    model_rounds: int,
    tool_call_count: int,
    input_tokens: int,
    output_tokens: int,
    estimated_cost: float | None,
    memory_context_chars: int,
    artifact_count: int,
    trace_id: str,
    model: str,
    prompt_version: str,
    status: str,
    failure_category: str | None = None,
) -> None:
    applied = [source.applied_scope for source in sources]
    freshness = [source.freshness for source in sources]
    try:
        await query(
            """INSERT INTO public.ai_chat_turn_metrics
                 (conversation_id, message_id, route, db_ms, model_ms, total_ms, cache_hits, source_count, answer_chars, status,
                  intent, query_spec, requested_filters, applied_filters, freshness, tool_names, warning_count, row_count, drilldown_count,
                  trace_id, model, prompt_version, model_rounds, tool_call_count, input_tokens, output_tokens, estimated_cost,
                  memory_context_chars, artifact_count, failure_category)
               VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb,
                       %s::jsonb, %s::jsonb, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                conversation_id, message_id, route[:120], db_ms, model_ms, total_ms, 0, len(sources), answer_chars, status,
                query_spec.get("intent", "agent"), json.dumps(query_spec, default=json_default), json.dumps({}, default=json_default),
                json.dumps(applied, default=json_default), json.dumps(freshness, default=json_default), json.dumps([source.label for source in sources]),
                sum(len(source.warnings) for source in sources), sum(int(source.execution_metrics.get("row_count", 0)) for source in sources), sum(bool(source.drilldown_ref) for source in sources),
                trace_id, model, prompt_version, model_rounds, tool_call_count, input_tokens, output_tokens, estimated_cost,
                memory_context_chars, artifact_count, failure_category,
            ),
        )
    except HTTPException as error:
        log_event(logging.ERROR, "ai_agent_turn_metrics_fallback", status_code=error.status_code)
        await persist_turn_metric(query, conversation_id=conversation_id, message_id=message_id, route=route, query_spec=query_spec, requested_filters={}, sources=sources, db_ms=db_ms, model_ms=model_ms, total_ms=total_ms, answer_chars=answer_chars, cache_hits=0, row_count=sum(int(source.execution_metrics.get("row_count", 0)) for source in sources), status=status)


async def persist_turn_metric(query: QueryFn, *, conversation_id: str, message_id: str, route: str, query_spec: dict[str, Any], requested_filters: dict[str, Any], sources: list[YaSource], db_ms: int, model_ms: int, total_ms: int, answer_chars: int, cache_hits: int, row_count: int, status: str) -> None:
    try:
        await query(
            """INSERT INTO public.ai_chat_turn_metrics
               (conversation_id, message_id, route, db_ms, model_ms, total_ms, cache_hits, source_count, answer_chars, status,
                intent, query_spec, requested_filters, applied_filters, freshness, tool_names, warning_count, row_count, drilldown_count)
               VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb, %s, %s, %s)""",
            (conversation_id, message_id, route[:120], db_ms, model_ms, total_ms, cache_hits, len(sources), answer_chars, status,
             query_spec.get("intent", ""), json.dumps(query_spec, default=json_default), json.dumps(requested_filters, default=json_default),
             json.dumps([source.applied_scope for source in sources], default=json_default), json.dumps([source.freshness for source in sources], default=json_default), json.dumps([source.id for source in sources]),
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


async def get_conversation(query: QueryFn, conversation_id: str, user_id: str, *, limit: int = 40, offset: int = 0) -> ConversationDetail:
    parsed_id = _uuid_or_422(conversation_id, "Identificador de conversa inválido")
    rows = await query("SELECT id::text, title, status, COALESCE(summary, '') AS summary, COALESCE(conversation_state, '{}'::jsonb) AS conversation_state, updated_at FROM public.ya_chat_conversations WHERE id = %s::uuid AND user_id = %s::uuid", (parsed_id, user_id))
    if not rows:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    safe_limit, safe_offset = max(1, min(limit, 100)), max(0, offset)
    try:
        messages = await query("SELECT id::text, role, content, sources, query_spec, evidence, artifacts, choices, created_at FROM public.ya_chat_messages WHERE conversation_id = %s::uuid ORDER BY created_at ASC LIMIT %s OFFSET %s", (parsed_id, safe_limit, safe_offset))
    except HTTPException as error:
        log_event(logging.WARNING, "ai_conversation_extended_message_columns_unavailable", status_code=error.status_code)
        messages = await query("SELECT id::text, role, content, sources, query_spec, evidence, created_at FROM public.ya_chat_messages WHERE conversation_id = %s::uuid ORDER BY created_at ASC LIMIT %s OFFSET %s", (parsed_id, safe_limit, safe_offset))
    conversation = rows[0]
    state = _json_value(conversation.get("conversation_state"), {})
    return ConversationDetail(
        id=conversation["id"], title=conversation["title"], status=conversation["status"], summary=conversation["summary"],
        conversation_state=state if isinstance(state, dict) else {}, updated_at=iso(conversation["updated_at"]),
        messages=[ConversationMessage(id=row["id"], role=row["role"], content=row["content"], sources=sources_from_db(row.get("sources")), query_spec=_json_value(row.get("query_spec"), {}), evidence=sources_from_db(row.get("evidence")), artifacts=_json_value(row.get("artifacts"), []), choices=_json_value(row.get("choices"), []), created_at=iso(row["created_at"])) for row in messages],
    )


async def close_conversation(query: QueryFn, conversation_id: str, user_id: str) -> dict[str, str]:
    parsed_id = _uuid_or_422(conversation_id, "Identificador de conversa inválido")
    rows = await query("UPDATE public.ya_chat_conversations SET status = 'closed', closed_at = NOW() WHERE id = %s::uuid AND user_id = %s::uuid AND status = 'active' RETURNING id::text", (parsed_id, user_id))
    if not rows:
        raise HTTPException(status_code=404, detail="Conversa não encontrada ou já encerrada")
    return {"id": rows[0]["id"], "status": "closed"}


async def persist_feedback(query: QueryFn, conversation_id: str, message_id: str, user_id: str, feedback_type: str) -> dict[str, str]:
    parsed_conversation_id = _uuid_or_422(conversation_id, "Identificador de feedback inválido")
    parsed_message_id = _uuid_or_422(message_id, "Identificador de feedback inválido")
    rows = await query(
        """UPDATE public.ai_chat_turn_metrics metric
           SET feedback_type = %s
           FROM public.ya_chat_conversations conversation
           WHERE metric.message_id = %s::uuid AND metric.conversation_id = conversation.id
             AND conversation.id = %s::uuid AND conversation.user_id = %s::uuid
           RETURNING metric.id::text""",
        (feedback_type, parsed_message_id, parsed_conversation_id, user_id),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Nenhum turno disponível para receber feedback")
    log_event(logging.INFO, "ai_turn_feedback_recorded", feedback_type=feedback_type)
    return {"status": "recorded"}


def _uuid_or_422(value: str, message: str) -> str:
    try:
        return str(uuid.UUID(value))
    except ValueError as error:
        log_event(logging.WARNING, "ai_memory_id_invalid", error_type=type(error).__name__)
        raise HTTPException(status_code=422, detail=message) from error
