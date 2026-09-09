"""Iterative tool-calling API for the v2 conversational BI agent."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Awaitable, Callable

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from ai_logger import log_event, log_exception
from auth import AuthenticatedBIUser, CurrentUser
from ya_agent_models import AgentChoice, AgentTurnResult, ToolCall, ToolExecution
from ya_agent_prompt import PROMPT_VERSION, assistant_tool_message, build_context, parse_final_content, tool_result_message
from ya_agent_tools import AgentToolRegistry, TOOL_DEFINITIONS
from ya_agent_tools.common import ToolContext, public_source
from ya_agent_tools.registry import TOOL_LABELS
from ya_agent_verifier import verify_answer
from ya_catalog import CATALOG_VERSION
from ya_db import database_health, query_async, query_read_only_async
from ya_memory import (
    ensure_conversation,
    forget_user_memory,
    load_agent_memory,
    load_user_memories,
    persist_agent_tool_run,
    persist_agent_turn_metrics,
    persist_message,
    update_agent_state,
)
from ya_models import YaChatRequest
from ya_provider import YA_MODEL, complete_with_tools, normalize_tool_calls, provider_health
from ya_schema import load_schema


router = APIRouter(prefix="/ai/v2", tags=["ai-agent-v2"])
V2_ENABLED = os.getenv("YA_AGENT_V2_ENABLED", "false").casefold() in {"1", "true", "yes", "on"}
MAX_MODEL_ROUNDS = 6
MAX_TOOL_CALLS = 8
MAX_EXPLORATORY_CALLS = 2
MAX_TOTAL_SECONDS = 90
REQUEST_LIMIT = 12
REQUEST_WINDOW_SECONDS = 10 * 60
_request_windows: dict[str, deque[float]] = defaultdict(deque)

EventCallback = Callable[[str, dict[str, Any]], Awaitable[None]]


class AgentLimitReached(RuntimeError):
    pass


class AgentRunner:
    """Orchestrate provider turns without embedding business SQL or semantics."""

    def __init__(self, *, registry: AgentToolRegistry | None = None, provider: Callable[..., Awaitable[dict[str, Any]]] | None = None):
        self.registry = registry or AgentToolRegistry()
        self.provider = provider or complete_with_tools

    async def run(self, request: YaChatRequest, user: CurrentUser, on_event: EventCallback | None = None) -> AgentTurnResult:
        started = time.monotonic()
        trace_id = str(uuid.uuid4())
        conversation_id = await ensure_conversation(query_async, request.conversation_id, user.id, request.context, request.message)
        memory = await load_agent_memory(query_async, conversation_id, user.id)
        user_message_id = await persist_message(
            query_async,
            conversation_id,
            "user",
            request.message.strip(),
            {"agent_version": "v2", "route": request.context.route},
            [],
            trace_id=trace_id,
            prompt_version=PROMPT_VERSION,
            model=YA_MODEL,
        )
        schema = await load_schema(query_read_only_async)
        prompt = build_context(request, memory, schema.prompt_text() if schema.available else "")
        tool_context = ToolContext(
            user_id=user.id,
            conversation_id=conversation_id,
            message_id=user_message_id,
            query=query_async,
            analytical_query=query_read_only_async,
            state_query=query_async,
            route=request.context.route,
            context_filters=request.context.filters.model_dump(by_alias=True, exclude_none=True),
            last_sources=memory.last_sources,
            schema_available=schema.available,
            schema_tables=schema.table_names,
        )
        await self._emit(on_event, "status", {"message": "Entendendo a sua pergunta…"})
        await self._emit(on_event, "thread", {"conversation_id": conversation_id})
        messages = list(prompt.messages)
        tool_outputs: list[ToolExecution] = []
        source_list = []
        artifact_list = []
        tool_names: list[str] = []
        seen_calls: set[str] = set()
        exploratory_calls = 0
        model_rounds = 0
        provider_ms = 0
        input_tokens = 0
        output_tokens = 0
        last_model = YA_MODEL
        finish_reasons: list[str] = []
        final_answer = ""
        choices: list[AgentChoice] = []
        topic_candidates: list[str] = []
        verification_retries = 0
        limit_reached = False

        while model_rounds < MAX_MODEL_ROUNDS:
            if time.monotonic() - started >= MAX_TOTAL_SECONDS:
                limit_reached = True
                break
            model_rounds += 1
            model_started = time.monotonic()
            remaining = max(0.1, MAX_TOTAL_SECONDS - (time.monotonic() - started))
            try:
                response = await asyncio.wait_for(self.provider(
                    messages,
                    TOOL_DEFINITIONS,
                    temperature=0.1,
                    max_tokens=1_400,
                    session_id=conversation_id,
                ), timeout=remaining)
            except asyncio.TimeoutError:
                log_event(logging.WARNING, "ai_agent_provider_timeout", trace_id=trace_id, model_round=model_rounds)
                limit_reached = True
                break
            if isinstance(response, dict) and "message" not in response and ("content" in response or "tool_calls" in response):
                response = {"message": response, "usage": {}, "model": YA_MODEL}
            provider_ms += round((time.monotonic() - model_started) * 1000)
            usage = response.get("usage", {}) if isinstance(response, dict) else {}
            input_tokens += _usage_int(usage, "prompt_tokens", "input_tokens")
            output_tokens += _usage_int(usage, "completion_tokens", "output_tokens")
            last_model = str(response.get("model") or YA_MODEL) if isinstance(response, dict) else YA_MODEL
            if isinstance(response, dict) and response.get("finish_reason"):
                finish_reasons.append(str(response["finish_reason"]))
            assistant = response.get("message", {}) if isinstance(response, dict) else {}
            if not isinstance(assistant, dict):
                raise HTTPException(status_code=502, detail="A resposta do modelo não veio em formato válido.")
            calls = normalize_tool_calls(assistant)
            if calls:
                messages.append(assistant_tool_message(assistant))
                for position, raw_call in enumerate(calls):
                    if len(tool_outputs) >= MAX_TOOL_CALLS:
                        limit_reached = True
                        break
                    call_id = str(raw_call.get("id") or f"call-{model_rounds}-{position}")
                    name = str(raw_call.get("name") or "")
                    arguments = raw_call.get("arguments")
                    call_key = _call_key(name, arguments)
                    if call_key in seen_calls:
                        execution = ToolExecution(
                            tool_name=name,
                            tool_call_id=call_id,
                            data={"status": "error", "error": {"category": "duplicate_call", "message": "Essa consulta idêntica já foi executada nesta rodada."}},
                            warnings=["Consulta repetida bloqueada."],
                            status="error",
                            error_category="duplicate_call",
                        )
                    elif name == "consultar_banco_bi" and exploratory_calls >= MAX_EXPLORATORY_CALLS:
                        execution = ToolExecution(
                            tool_name=name,
                            tool_call_id=call_id,
                            data={"status": "error", "error": {"category": "exploration_limit", "message": "O limite de investigações exploratórias desta pergunta foi atingido."}},
                            warnings=["Limite de exploração atingido."],
                            status="error",
                            error_category="exploration_limit",
                        )
                    else:
                        seen_calls.add(call_key)
                        if name == "consultar_banco_bi":
                            exploratory_calls += 1
                        tool_names.append(name)
                        topic_candidates.append(_topic_from_tool(name, arguments))
                        await self._emit(on_event, "status", {"message": f"Consultando {TOOL_LABELS.get(name, 'a fonte do BI')}…"})
                        await self._emit(on_event, "tool_start", {"label": TOOL_LABELS.get(name, "a fonte do BI"), "position": len(tool_outputs) + 1})
                        remaining = max(0.1, MAX_TOTAL_SECONDS - (time.monotonic() - started))
                        try:
                            execution = await asyncio.wait_for(
                                self.registry.execute(ToolCall(call_id=call_id, name=name, arguments=arguments if isinstance(arguments, dict) else arguments), tool_context),
                                timeout=remaining,
                            )
                        except asyncio.TimeoutError:
                            log_event(logging.WARNING, "ai_agent_tool_timeout", trace_id=trace_id, tool_name=name)
                            execution = ToolExecution(
                                tool_name=name,
                                tool_call_id=call_id,
                                data={"status": "error", "error": {"category": "timeout", "message": "A consulta excedeu o tempo limite."}},
                                warnings=["Limite de tempo atingido."],
                                status="error",
                                error_category="timeout",
                            )
                    tool_outputs.append(execution)
                    if execution.source:
                        source_list.append(execution.source)
                    artifact_list.extend(execution.artifacts)
                    await self._persist_tool(conversation_id, user_message_id, execution, name, arguments, trace_id)
                    await self._emit(on_event, "tool_result", {
                        "label": TOOL_LABELS.get(name, "a fonte do BI"),
                        "status": execution.status,
                        "source": public_source(execution.source).model_dump() if execution.source else None,
                        "artifacts": [artifact.model_dump() for artifact in execution.artifacts],
                        "warnings": execution.warnings[:6],
                    })
                    messages.append(tool_result_message(call_id, execution.model_payload()))
                    tool_context.last_sources = list(source_list)
                if limit_reached:
                    break
                continue
            raw_content = assistant.get("content")
            if not isinstance(raw_content, str):
                raw_content = ""
            final_answer, raw_choices = parse_final_content(raw_content)
            choices = _choices(raw_choices)
            if not final_answer:
                final_answer = "Não consegui formular uma resposta segura para esta pergunta."
            verification = verify_answer(final_answer, [execution.model_payload() for execution in tool_outputs])
            if not verification.valid and verification_retries == 0:
                verification_retries += 1
                messages.append({"role": "system", "content": "A verificação encontrou números sem evidência nesta rodada. Reescreva a resposta sem inventar números; use apenas os valores e períodos presentes nos resultados das ferramentas, ou explique que faltou evidência. Responda no JSON combinado."})
                continue
            if not verification.valid:
                final_answer = "Não consegui confirmar todos os números da resposta com as fontes consultadas. Posso refazer com um recorte mais específico."
                choices = []
            break
        else:
            limit_reached = True

        if limit_reached and not final_answer:
            final_answer = "Não consegui concluir a análise dentro do limite desta pergunta. Tente um período ou recorte menor."
            choices = []
        if not final_answer:
            final_answer = "Não encontrei dados suficientes para responder com segurança."
        await self._emit(on_event, "status", {"message": "Preparando a resposta…"})
        await self._emit(on_event, "delta", {"text": final_answer})
        public_sources = [public_source(source) for source in _unique_sources(source_list)]
        public_artifacts = _unique_artifacts(artifact_list)
        query_spec = {
            "agent_version": "v2",
            "catalog_version": CATALOG_VERSION,
            "domain": _active_topic(topic_candidates),
            "source_count": len(public_sources),
            "topics": list(dict.fromkeys(TOOL_LABELS.get(name, "fonte do BI") for name in tool_names)),
            "verification": "passed" if verification_retries == 0 else "retry_checked",
        }
        db_ms = sum(int(source.execution_metrics.get("elapsed_ms", 0)) for source in source_list)
        cache_hits = sum(bool(source.execution_metrics.get("cache_hit", False)) for source in source_list)
        await self._emit(on_event, "plan", {"query_spec": query_spec})
        await self._emit(on_event, "sources", {
            "sources": [source.model_dump() for source in public_sources],
            "db_ms": db_ms,
            "cache_hits": cache_hits,
        })
        assistant_message_id = await persist_message(
            query_async,
            conversation_id,
            "assistant",
            final_answer,
            query_spec,
            public_sources,
            artifacts=[artifact.model_dump() for artifact in public_artifacts],
            choices=[choice.model_dump() for choice in choices],
            trace_id=trace_id,
            prompt_version=PROMPT_VERSION,
            model=last_model,
        )
        state = await update_agent_state(
            query_async,
            conversation_id,
            memory.state,
            memory.summary,
            request.message,
            final_answer,
            request.context,
            query_spec,
            public_sources,
        )
        total_ms = round((time.monotonic() - started) * 1000)
        stats = {
            "trace_id": trace_id,
            "model": last_model,
            "prompt_version": PROMPT_VERSION,
            "model_rounds": model_rounds,
            "tool_call_count": len(tool_outputs),
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "finish_reasons": finish_reasons,
            "estimated_cost": _estimated_cost(input_tokens, output_tokens),
            "memory_context_chars": prompt.memory_chars,
            "artifact_count": len(public_artifacts),
            "provider_ms": provider_ms,
            "total_ms": total_ms,
            "failure_category": "limit" if limit_reached else None,
        }
        await persist_agent_turn_metrics(
            query_async,
            conversation_id=conversation_id,
            message_id=assistant_message_id,
            route=request.context.route,
            query_spec=query_spec,
            sources=source_list,
            db_ms=db_ms,
            model_ms=provider_ms,
            total_ms=total_ms,
            answer_chars=len(final_answer),
            model_rounds=model_rounds,
            tool_call_count=len(tool_outputs),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost=stats["estimated_cost"],
            memory_context_chars=prompt.memory_chars,
            artifact_count=len(public_artifacts),
            trace_id=trace_id,
            model=last_model,
            prompt_version=PROMPT_VERSION,
            status="completed",
            failure_category=stats["failure_category"],
        )
        log_event(logging.INFO, "ai_agent_turn_completed", trace_id=trace_id, user_hash=_user_hash(user.id), model_rounds=model_rounds, tool_call_count=len(tool_outputs), total_ms=total_ms)
        return AgentTurnResult(
            conversation_id=conversation_id,
            user_message_id=user_message_id,
            assistant_message_id=assistant_message_id,
            answer=final_answer,
            evidence=public_sources,
            artifacts=public_artifacts,
            choices=choices,
            query_spec={**query_spec, "state_active_topic": state.get("active_topic")},
            stats=stats,
        )

    async def _persist_tool(self, conversation_id: str, message_id: str, execution: ToolExecution, name: str, arguments: Any, trace_id: str) -> None:
        try:
            await persist_agent_tool_run(
                query_async,
                conversation_id=conversation_id,
                message_id=message_id,
                tool_name=name,
                tool_call_id=execution.tool_call_id,
                tool_input=_safe_tool_input(arguments),
                result_preview=execution.model_payload(),
                presentation={"artifact_types": [artifact.type for artifact in execution.artifacts]},
                source=execution.source,
                elapsed_ms=int(execution.source.execution_metrics.get("elapsed_ms", 0)) if execution.source else 0,
                status=execution.status,
                error_category=execution.error_category,
                started_at=datetime.now(timezone.utc).isoformat(),
                completed_at=datetime.now(timezone.utc).isoformat(),
            )
        except Exception as error:
            log_exception("ai_agent_tool_trace_failed", error, trace_id=trace_id, tool_name=name)

    async def _emit(self, callback: EventCallback | None, event: str, data: dict[str, Any]) -> None:
        if callback:
            await callback(event, data)


def _check_rate_limit(user_id: str) -> None:
    now = time.monotonic()
    window = _request_windows[user_id]
    while window and window[0] <= now - REQUEST_WINDOW_SECONDS:
        window.popleft()
    if len(window) >= REQUEST_LIMIT:
        raise HTTPException(status_code=429, detail="Limite temporário de perguntas atingido. Tente novamente em alguns minutos.")
    window.append(now)


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


def _usage_int(usage: Any, *keys: str) -> int:
    if not isinstance(usage, dict):
        return 0
    for key in keys:
        try:
            return max(0, int(usage.get(key) or 0))
        except (TypeError, ValueError) as error:
            log_event(logging.DEBUG, "ai_agent_usage_value_invalid", error_type=type(error).__name__)
            continue
    return 0


def _call_key(name: str, arguments: Any) -> str:
    try:
        encoded = json.dumps(arguments, ensure_ascii=False, sort_keys=True, default=str)
    except TypeError as error:
        log_event(logging.DEBUG, "ai_agent_call_key_fallback", error_type=type(error).__name__)
        encoded = str(arguments)[:2_000]
    return f"{name}:{encoded}"


def _topic_from_tool(name: str, arguments: Any) -> str:
    if name == "consultar_desempenho_vendas":
        return "vendas"
    if name == "consultar_acoes_comerciais":
        return "acoes"
    if name == "consultar_desempenho_equipe":
        return "equipe"
    if name == "consultar_banco_bi":
        return "exploratory"
    if name in {"guardar_memoria_usuario", "esquecer_memoria_usuario"}:
        return "conversation"
    if isinstance(arguments, dict):
        domain = arguments.get("dominio")
        if isinstance(domain, str) and domain in {"vendas", "acoes", "equipe"}:
            return domain
        for key in ("metrica", "metrica_a", "metrica_b"):
            metric = arguments.get(key)
            if isinstance(metric, str) and metric.split(".", 1)[0] in {"vendas", "acoes", "equipe"}:
                return metric.split(".", 1)[0]
    if name in {"explicar_conceito", "consultar_atualizacao"}:
        return "conversation"
    return "conversation"


def _active_topic(candidates: list[str]) -> str:
    for topic in reversed(candidates):
        if topic in {"vendas", "acoes", "equipe", "exploratory"}:
            return topic
    return "conversation"


def _safe_tool_input(arguments: Any) -> dict[str, Any]:
    if not isinstance(arguments, dict):
        return {"invalid": True}
    output = dict(arguments)
    if "sql" in output:
        sql = str(output.pop("sql") or "")
        output["query_hash"] = hashlib.sha256(sql.encode("utf-8")).hexdigest()
    return _safe_json(output)


def _safe_json(value: Any, depth: int = 0) -> Any:
    if depth > 4:
        return "…"
    if isinstance(value, dict):
        return {str(key)[:120]: _safe_json(item, depth + 1) for key, item in list(value.items())[:32]}
    if isinstance(value, list):
        return [_safe_json(item, depth + 1) for item in value[:20]]
    if isinstance(value, str):
        return value[:500]
    return value


def _unique_sources(sources: list[Any]) -> list[Any]:
    output = []
    seen = set()
    for source in sources:
        if source.id in seen:
            continue
        seen.add(source.id)
        output.append(source)
    return output


def _unique_artifacts(artifacts: list[Any]) -> list[Any]:
    output = []
    seen = set()
    for artifact in artifacts:
        key = json.dumps(artifact.model_dump(), ensure_ascii=False, sort_keys=True, default=str)
        if key in seen:
            continue
        seen.add(key)
        output.append(artifact)
    return output[:12]


def _choices(items: list[dict[str, str]]) -> list[AgentChoice]:
    choices: list[AgentChoice] = []
    for item in items[:6]:
        try:
            choices.append(AgentChoice.model_validate(item))
        except ValueError as error:
            log_event(logging.DEBUG, "ai_agent_choice_rejected", error_type=type(error).__name__)
            continue
    return choices


def _estimated_cost(input_tokens: int, output_tokens: int) -> float | None:
    try:
        input_rate = float(os.getenv("YA_AGENT_INPUT_USD_PER_1K", "0"))
        output_rate = float(os.getenv("YA_AGENT_OUTPUT_USD_PER_1K", "0"))
    except ValueError as error:
        log_event(logging.WARNING, "ai_agent_cost_configuration_invalid", error_type=type(error).__name__)
        return None
    if input_rate == 0 and output_rate == 0:
        return None
    return round((input_tokens / 1000) * input_rate + (output_tokens / 1000) * output_rate, 8)


def _user_hash(user_id: str) -> str:
    return hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:16]


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
    if not V2_ENABLED:
        raise HTTPException(status_code=404, detail="Agente v2 desativada neste ambiente")
    return await load_user_memories(query_async, user.id, limit)


@router.delete("/memories/{memory_key}")
async def forget_memory(memory_key: str, user: AuthenticatedBIUser):
    if not V2_ENABLED:
        raise HTTPException(status_code=404, detail="Agente v2 desativada neste ambiente")
    try:
        return await forget_user_memory(query_async, user_id=user.id, memory_key=memory_key)
    except ValueError as error:
        log_event(logging.WARNING, "ai_agent_memory_key_invalid", error_type=type(error).__name__)
        raise HTTPException(status_code=422, detail="Memória inválida") from error


@router.post("/chat")
async def agent_chat(request: YaChatRequest, user: AuthenticatedBIUser):
    _ensure_enabled()
    _check_rate_limit(user.id)
    result = await AgentRunner().run(request, user)
    return _result_payload(result)


@router.post("/chat/stream")
async def agent_chat_stream(request: YaChatRequest, user: AuthenticatedBIUser) -> StreamingResponse:
    _ensure_enabled()
    _check_rate_limit(user.id)
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
                    result = data["result"] if isinstance(data, dict) else None
                    if isinstance(result, AgentTurnResult):
                        yield _sse("done", _result_payload(result))
                    break
                if event == "__error__":
                    error = data if isinstance(data, BaseException) else RuntimeError("agent failure")
                    if isinstance(error, HTTPException):
                        detail = error.detail if isinstance(error.detail, str) else "Não foi possível concluir esta consulta."
                    else:
                        log_exception("ai_agent_stream_failed", error)
                        detail = "Não consegui concluir esta consulta agora. Tente reformular a pergunta ou reduzir o recorte."
                    yield _sse("error", {"detail": detail, "trace_id": str(uuid.uuid4())})
                    break
                if event:
                    yield _sse(event, data if isinstance(data, dict) else {})
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


def _result_payload(result: AgentTurnResult) -> dict[str, Any]:
    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "conversation_id": result.conversation_id,
        "assistant_message_id": result.assistant_message_id,
        "answer": result.answer,
        "sources": [source.model_dump() for source in result.evidence],
        "evidence": [source.model_dump() for source in result.evidence],
        "artifacts": [artifact.model_dump() for artifact in result.artifacts],
        "choices": [choice.model_dump() for choice in result.choices],
        "query_spec": result.query_spec,
        "stats": result.stats,
        "generated_at": generated_at,
    }
