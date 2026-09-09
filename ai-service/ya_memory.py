"""Conversation persistence and structured investigation memory."""

from __future__ import annotations

import json
import logging
import re
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Awaitable, Callable, Optional

from fastapi import HTTPException

from ai_logger import log_event
from ya_models import ConversationDetail, ConversationMessage, ConversationPreview, YaContext, YaSource


THREAD_HISTORY_MESSAGES = 16
THREAD_SUMMARY_MAX_CHARS = 3_200
QueryFn = Callable[[str, tuple[Any, ...]], Awaitable[list[dict[str, Any]]]]
MEMORY_CONTENT_MAX_CHARS = 1_000
SENSITIVE_MEMORY = re.compile(
    r"(?:sk[-_ ]?[a-z0-9]{12,}|bearer\s+[a-z0-9._-]{12,}|password|senha|secret|token|api[_ -]?key|"
    r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[-.\s]?\d{4}|"
    r"\b(?:cpf|cnpj|chassi|n[uú]mero de s[ée]rie|documento)\b)",
    re.IGNORECASE,
)
CURRENT_METRIC_MEMORY = re.compile(
    r"(?:r\$|\b(?:faturamento|vendas?|pedidos?|perdas?|ticket|meta|convers[aã]o)\b\s*[:=]?\s*\d)",
    re.IGNORECASE,
)


@dataclass
class ThreadMemory:
    summary: str
    state: dict[str, Any]
    history: list[dict[str, str]]
    last_sources: list[YaSource]
    user_memories: list[dict[str, str]] = field(default_factory=list)


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
            log_event(logging.WARNING, "ai_conversation_id_invalid", error_type=type(error).__name__)
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


async def load_user_memories(query: QueryFn, user_id: str, limit: int = 24) -> list[dict[str, str]]:
    """Load durable, non-factual memories without making chat depend on a new migration."""
    try:
        rows = await query(
            """SELECT memory_key, category, content
               FROM public.ya_user_memories
               WHERE user_id = %s::uuid AND status = 'active'
               ORDER BY updated_at DESC LIMIT %s""",
            (user_id, max(1, min(limit, 50))),
        )
    except HTTPException as error:
        log_event(logging.WARNING, "ai_user_memory_unavailable", status_code=error.status_code)
        return []
    memories: list[dict[str, str]] = []
    for row in rows:
        key = str(row.get("memory_key") or "")
        content = " ".join(str(row.get("content") or "").split())[:MEMORY_CONTENT_MAX_CHARS]
        if not key or not content or _memory_is_sensitive(key, content):
            continue
        memories.append({"key": key[:120], "category": str(row.get("category") or "context"), "content": content})
    return memories


async def load_agent_memory(query: QueryFn, conversation_id: str, user_id: str) -> ThreadMemory:
    """Load thread context plus durable memories with graceful degradation."""
    thread = await load_thread_memory(query, conversation_id, user_id)
    thread.user_memories = await load_user_memories(query, user_id)
    return thread


async def forget_user_memory(query: QueryFn, *, user_id: str, memory_key: str) -> dict[str, str]:
    normalized_key = " ".join(memory_key.split())[:120]
    if not normalized_key:
        raise ValueError("memory key is empty")
    rows = await query(
        """UPDATE public.ya_user_memories
           SET status = 'forgotten', updated_at = NOW()
           WHERE user_id = %s::uuid AND memory_key = %s AND status = 'active'
           RETURNING memory_key""",
        (user_id, normalized_key),
    )
    return {"status": "forgotten" if rows else "not_found", "key": normalized_key}


def _memory_is_sensitive(key: str, content: str) -> bool:
    combined = f"{key} {content}"
    return bool(SENSITIVE_MEMORY.search(combined) or CURRENT_METRIC_MEMORY.search(combined))


async def save_user_memory(
    query: QueryFn,
    *,
    user_id: str,
    memory_key: str,
    category: str,
    content: str,
    conversation_id: str,
    message_id: str,
) -> dict[str, str]:
    categories = {"identity", "preference", "business_choice", "context"}
    normalized_key = " ".join(memory_key.split())[:120]
    normalized_content = " ".join(content.split())[:MEMORY_CONTENT_MAX_CHARS]
    if not normalized_key or not normalized_content or category not in categories:
        raise HTTPException(status_code=422, detail="Memória do usuário inválida")
    if _memory_is_sensitive(normalized_key, normalized_content):
        raise ValueError("Memória contém segredo, contato, documento ou número corrente do BI")
    rows = await query(
        """INSERT INTO public.ya_user_memories
             (user_id, memory_key, category, content, source_conversation_id, source_message_id)
           VALUES (%s::uuid, %s, %s, %s, %s::uuid, %s::uuid)
           ON CONFLICT (user_id, memory_key) DO UPDATE SET
             category = EXCLUDED.category,
             content = EXCLUDED.content,
             source_conversation_id = EXCLUDED.source_conversation_id,
             source_message_id = EXCLUDED.source_message_id,
             status = 'active',
             updated_at = NOW()
           RETURNING memory_key, category, content""",
        (user_id, normalized_key, category, normalized_content, conversation_id, message_id),
    )
    if not rows:
        raise HTTPException(status_code=503, detail="Não foi possível guardar essa preferência agora")
    return {"status": "saved", "key": normalized_key, "category": category}


async def persist_message(
    query: QueryFn,
    conversation_id: str,
    role: str,
    content: str,
    query_spec: dict[str, Any],
    evidence: list[YaSource],
    *,
    artifacts: list[dict[str, Any]] | None = None,
    choices: list[dict[str, Any]] | None = None,
    trace_id: str | None = None,
    prompt_version: str | None = None,
    model: str | None = None,
) -> str:
    encoded = json.dumps([item.model_dump() for item in evidence], default=json_default)
    try:
        rows = await query(
            """INSERT INTO public.ya_chat_messages
                 (conversation_id, role, content, sources, query_spec, evidence, artifacts, choices, trace_id, prompt_version, model)
               VALUES (%s::uuid, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb, %s, %s, %s)
               RETURNING id::text""",
            (conversation_id, role, content, encoded, json.dumps(query_spec, default=json_default), encoded,
             json.dumps(artifacts or [], default=json_default), json.dumps(choices or [], default=json_default), trace_id,
             prompt_version, model),
        )
    except HTTPException as error:
        log_event(logging.WARNING, "ai_message_extended_columns_unavailable", status_code=error.status_code)
        rows = await query(
            """INSERT INTO public.ya_chat_messages (conversation_id, role, content, sources, query_spec, evidence)
               VALUES (%s::uuid, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb) RETURNING id::text""",
            (conversation_id, role, content, encoded, json.dumps(query_spec, default=json_default), encoded),
        )
    return str(rows[0]["id"])


def structured_thread_state(previous: dict[str, Any], message: str, answer: str, context: YaContext, query_spec: dict[str, Any], evidence: list[YaSource]) -> dict[str, Any]:
    """Update topic-scoped state without copying current numbers as memory."""
    state = dict(previous) if isinstance(previous, dict) else {}
    topics = dict(state.get("topics")) if isinstance(state.get("topics"), dict) else {}
    topic = str(query_spec.get("domain") or query_spec.get("intent") or "vendas")
    if topic not in {"vendas", "acoes", "equipe", "exploratory", "conversation"}:
        topic = "vendas"
    filters = context.filters.model_dump(by_alias=True, exclude_none=True)
    period = {}
    if isinstance(query_spec.get("period"), dict):
        period = {key: query_spec["period"].get(key) for key in ("from", "to") if query_spec["period"].get(key)}
    topics[topic] = {
        "period": period,
        "filters": filters,
        "last_evidence_ids": [source.id for source in evidence[:12]],
        "last_query_kind": query_spec.get("intent", ""),
    }
    state.update({
        "active_topic": topic,
        "topics": topics,
        "last_query_spec": query_spec,
        "last_question": message[:500],
        "last_answer": answer[:800],
        "last_sources": [item.model_dump(exclude={"preview", "lineage"}) for item in evidence] or state.get("last_sources", []),
        "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    })
    return state


def progressive_summary(previous: str, message: str, answer: str, context: YaContext, state: dict[str, Any]) -> str:
    """Keep a bounded, human-readable summary while originals stay persisted."""
    filters = context.filters.model_dump(by_alias=True, exclude_none=True)
    payload = {
        "assuntos": sorted((state.get("topics") or {}).keys()),
        "ativo": state.get("active_topic", ""),
        "filtros_recentes": filters,
        "pergunta_pendente": message[:240],
        "ultima_resposta": answer[:420],
    }
    encoded = json.dumps(payload, ensure_ascii=False, default=json_default)
    return encoded[:THREAD_SUMMARY_MAX_CHARS]


async def update_agent_state(query: QueryFn, conversation_id: str, previous_state: dict[str, Any], previous_summary: str, message: str, answer: str, context: YaContext, query_spec: dict[str, Any], evidence: list[YaSource]) -> dict[str, Any]:
    state = structured_thread_state(previous_state, message, answer, context, query_spec, evidence)
    await query(
        """UPDATE public.ya_chat_conversations
           SET summary = %s, summary_updated_at = NOW(), last_context = %s::jsonb, conversation_state = %s::jsonb
           WHERE id = %s::uuid""",
        (progressive_summary(previous_summary, message, answer, context, state), json.dumps(context.model_dump(by_alias=True), default=json_default), json.dumps(state, default=json_default), conversation_id),
    )
    return state


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
    source: YaSource | None,
    elapsed_ms: int,
    status: str,
    error_category: str | None = None,
    started_at: str | None = None,
    completed_at: str | None = None,
) -> None:
    """Persist an auditable v2 tool run, without exposing raw SQL to users."""
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
                safe_source.intent, "v2", json.dumps({"tool": tool_name}, default=json_default),
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
                await persist_tool_run(
                    query, conversation_id, message_id, tool_name, {"tool": tool_name}, source,
                    tool_call_id=tool_call_id, tool_input=tool_input, result_preview=result_preview, presentation=presentation,
                )
            except HTTPException as fallback_error:
                log_event(logging.WARNING, "ai_agent_tool_trace_minimal_fallback", status_code=fallback_error.status_code)
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
        try:
            await persist_turn_metric(
                query, conversation_id=conversation_id, message_id=message_id, route=route, query_spec=query_spec,
                requested_filters={}, sources=sources, db_ms=db_ms, model_ms=model_ms, total_ms=total_ms,
                answer_chars=answer_chars, cache_hits=0, row_count=sum(int(source.execution_metrics.get("row_count", 0)) for source in sources), status=status,
            )
        except HTTPException as fallback_error:
            log_event(logging.WARNING, "ai_agent_turn_metrics_minimal_fallback", status_code=fallback_error.status_code)
            await query(
                """INSERT INTO public.ai_chat_turn_metrics
                     (conversation_id, message_id, route, db_ms, model_ms, total_ms, cache_hits, source_count, answer_chars, status)
                   VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (conversation_id, message_id, route[:120], db_ms, model_ms, total_ms, 0, len(sources), answer_chars, status),
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


async def get_conversation(query: QueryFn, conversation_id: str, user_id: str, *, limit: int = 40, offset: int = 0) -> ConversationDetail:
    try:
        parsed_id = str(uuid.UUID(conversation_id))
    except ValueError as error:
        log_event(logging.WARNING, "ai_conversation_id_invalid", error_type=type(error).__name__)
        raise HTTPException(status_code=422, detail="Identificador de conversa inválido") from error
    rows = await query("SELECT id::text, title, status, COALESCE(summary, '') AS summary, COALESCE(conversation_state, '{}'::jsonb) AS conversation_state, updated_at FROM public.ya_chat_conversations WHERE id = %s::uuid AND user_id = %s::uuid", (parsed_id, user_id))
    if not rows:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    safe_limit = max(1, min(limit, 100))
    safe_offset = max(0, offset)
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
    try:
        parsed_id = str(uuid.UUID(conversation_id))
    except ValueError as error:
        log_event(logging.WARNING, "ai_conversation_id_invalid", error_type=type(error).__name__)
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
        log_event(logging.WARNING, "ai_feedback_id_invalid", error_type=type(error).__name__)
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
