"""Bounded model/tool loop for the v2 conversational BI agent."""

from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from fastapi import HTTPException

from ai_logger import log_event, log_exception
from auth import CurrentUser
from ya_agent_contract import contract_evidence_status
from ya_agent_intent import resolve_turn
from ya_agent_models import AgentChoice, AgentTurnResult, ToolCall, ToolExecution
from ya_agent_prompt import PROMPT_VERSION, assistant_tool_message, build_context, parse_final_content, tool_result_message
from ya_agent_support import (
    active_topic,
    call_key,
    choices,
    error_tool_execution,
    estimated_cost,
    safe_tool_input,
    topic_from_tool,
    unique_artifacts,
    unique_sources,
    usage_int,
    user_hash,
)
from ya_agent_tools import AgentToolRegistry, TOOL_DEFINITIONS
from ya_agent_tools.common import ToolContext, public_source
from ya_agent_tools.registry import TOOL_LABELS
from ya_agent_verifier import verify_answer
from ya_catalog import CATALOG_VERSION
from ya_db import query_async, query_read_only_async
from ya_memory import (
    ensure_conversation,
    load_agent_memory,
    persist_message,
    update_agent_state,
)
from ya_memory_persistence import persist_agent_tool_run, persist_agent_turn_metrics
from ya_models import YaChatRequest
from ya_provider import YA_MODEL, complete_structured, complete_with_tools, normalize_tool_calls
from ya_schema import load_schema


MAX_MODEL_ROUNDS = 6
MAX_TOOL_CALLS = 8
MAX_EXPLORATORY_CALLS = 2
MAX_TOTAL_SECONDS = int(os.getenv("YA_AGENT_MAX_TOTAL_SECONDS", "180"))
MEMORY_WRITE_TOOLS = {"guardar_memoria_usuario", "esquecer_memoria_usuario"}
EventCallback = Callable[[str, dict[str, Any]], Awaitable[None]]


class AgentRunner:
    """Run semantic routing, official tools and evidence-checked prose."""

    def __init__(self, *, registry: AgentToolRegistry | None = None, provider: Callable[..., Awaitable[dict[str, Any]]] | None = None, intent_provider: Callable[..., Awaitable[Any]] | None = None):
        self.registry = registry or AgentToolRegistry()
        self.provider = provider or complete_with_tools
        self.intent_provider = intent_provider if intent_provider is not None else (complete_structured if provider is None else None)

    async def run(self, request: YaChatRequest, user: CurrentUser, on_event: EventCallback | None = None) -> AgentTurnResult:
        started = time.monotonic()
        trace_id = str(uuid.uuid4())
        conversation_id = await ensure_conversation(query_async, request.conversation_id, user.id, request.context, request.message)
        memory = await load_agent_memory(query_async, conversation_id, user.id)
        resolution = await resolve_turn(request, memory.state, memory.last_sources, classifier=self.intent_provider, session_id=conversation_id)
        contract = resolution.contract
        user_message_id = await persist_message(query_async, conversation_id, "user", request.message.strip(), {"agent_version": "v2", "route": request.context.route}, [], trace_id=trace_id, prompt_version=PROMPT_VERSION, model=YA_MODEL)
        schema = await load_schema(query_read_only_async)
        prompt = build_context(request, memory, schema.prompt_text() if schema.available else "", contract)
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
        source_list: list[Any] = []
        artifact_list: list[Any] = []
        tool_names: list[str] = []
        seen_calls: set[str] = set()
        exploratory_calls = 0
        model_rounds = 0
        provider_ms = 0
        input_tokens = resolution.classifier_input_tokens
        output_tokens = resolution.classifier_output_tokens
        last_model = YA_MODEL
        finish_reasons: list[str] = []
        final_answer = ""
        choices_result: list[AgentChoice] = []
        topic_candidates: list[str] = []
        verification_retries = 0
        contract_status = "pending" if contract.requires_evidence else ("clarification" if contract.intent == "clarify" else "not_required")
        limit_reached = False

        while model_rounds < MAX_MODEL_ROUNDS:
            if contract.intent == "clarify":
                # Ambiguous coverage is a server-owned clarification, not a
                # model turn.  Some OpenAI-compatible providers emit legacy
                # ``<function=...>`` markup as plain content when tools are
                # disabled; never let that markup become the user answer.
                final_answer = contract.clarification_text or "Pode esclarecer qual recorte você quer comparar?"
                choices_result = choices(list(contract.choices))
                break
            if contract.intent == "casual":
                final_answer = "Olá! Seja bem-vindo ao Ceres BI. Estou aqui para ajudar com análises de vendas, faturamento, pedidos aprovados, perdas, rankings e comparações de períodos. Como posso ajudar você hoje?"
                break
            if time.monotonic() - started >= MAX_TOTAL_SECONDS:
                limit_reached = True
                break
            model_rounds += 1
            model_started = time.monotonic()
            remaining = max(0.1, MAX_TOTAL_SECONDS - (time.monotonic() - started))
            required_tool = contract.next_required_tool(tool_outputs)
            if contract.requires_evidence and required_tool is None and any(e.status == "ok" for e in tool_outputs):
                tool_choice_mode: Any = "none"
            elif (model_rounds == 1 or required_tool) and required_tool:
                tool_choice_mode = contract.tool_choice(required_tool)
            elif any(e.tool_name == "consultar_banco_bi" and e.status == "ok" for e in tool_outputs):
                tool_choice_mode = "none"
            else:
                tool_choice_mode = "auto"

            round_max_tokens = 280 if tool_choice_mode != "none" else 1_200
            try:
                response = await asyncio.wait_for(
                    self.provider(
                        messages,
                        TOOL_DEFINITIONS,
                        temperature=0.1,
                        max_tokens=round_max_tokens,
                        session_id=conversation_id,
                        tool_choice=tool_choice_mode,
                    ),
                    timeout=remaining,
                )
            except asyncio.TimeoutError:
                log_event(logging.WARNING, "ai_agent_provider_timeout", trace_id=trace_id, model_round=model_rounds)
                limit_reached = True
                break
            if isinstance(response, dict) and "message" not in response and ("content" in response or "tool_calls" in response):
                response = {"message": response, "usage": {}, "model": YA_MODEL}
            if not isinstance(response, dict) or "message" not in response:
                log_event(logging.ERROR, "ai_agent_provider_invalid_response", trace_id=trace_id, model_round=model_rounds)
                raise HTTPException(status_code=502, detail="A resposta do modelo não veio em formato válido.")
            provider_ms += round((time.monotonic() - model_started) * 1000)
            usage = response.get("usage", {})
            input_tokens += usage_int(usage, "prompt_tokens", "input_tokens")
            output_tokens += usage_int(usage, "completion_tokens", "output_tokens")
            last_model = str(response.get("model") or YA_MODEL)
            if response.get("finish_reason"):
                finish_reasons.append(str(response["finish_reason"]))
            assistant = response.get("message", {})
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
                    call_key_value = call_key(name, arguments)
                    if name in MEMORY_WRITE_TOOLS and name not in contract.tool_names:
                        execution = error_tool_execution(
                            name,
                            call_id,
                            category="contract_forbidden",
                            message="A memória só pode ser alterada quando isso for pedido explicitamente.",
                            warning="Alteração de memória fora do pedido explícito bloqueada.",
                        )
                    elif required_tool and name != required_tool and name != "consultar_banco_bi":
                        execution = error_tool_execution(
                            name,
                            call_id,
                            category="contract_required",
                            message="A ferramenta necessária para esta pergunta não foi usada.",
                            warning="A ferramenta exigida pelo contrato semântico não foi usada.",
                        )
                    elif call_key_value in seen_calls:
                        execution = error_tool_execution(
                            name,
                            call_id,
                            category="duplicate_call",
                            message="Essa consulta idêntica já foi executada nesta rodada.",
                            warning="Consulta repetida bloqueada.",
                        )
                    elif name == "consultar_banco_bi" and exploratory_calls >= MAX_TOOL_CALLS:
                        execution = error_tool_execution(
                            name,
                            call_id,
                            category="exploration_limit",
                            message="O limite de investigações desta pergunta foi atingido.",
                            warning="Limite de exploração atingido.",
                        )
                    else:
                        seen_calls.add(call_key_value)
                        if not arguments or (isinstance(arguments, dict) and not arguments.get("sql") and name != "consultar_banco_bi"):
                            arguments = contract.tool_arguments(name, arguments)
                        if name == "consultar_banco_bi":
                            exploratory_calls += 1
                        tool_names.append(name)
                        topic_candidates.append(topic_from_tool(name, arguments))
                        await self._emit(on_event, "status", {"message": f"Consultando {TOOL_LABELS.get(name, 'a fonte do BI')}…"})
                        await self._emit(on_event, "tool_start", {"label": TOOL_LABELS.get(name, "a fonte do BI"), "position": len(tool_outputs) + 1})
                        remaining = max(0.1, MAX_TOTAL_SECONDS - (time.monotonic() - started))
                        try:
                            execution = await asyncio.wait_for(self.registry.execute(ToolCall(call_id=call_id, name=name, arguments=arguments if isinstance(arguments, dict) else arguments), tool_context), timeout=remaining)
                        except asyncio.TimeoutError:
                            log_event(logging.WARNING, "ai_agent_tool_timeout", trace_id=trace_id, tool_name=name)
                            execution = error_tool_execution(
                                name,
                                call_id,
                                category="timeout",
                                message="A consulta excedeu o tempo limite.",
                                warning="Limite de tempo atingido.",
                            )
                    tool_outputs.append(execution)
                    if execution.source:
                        source_list.append(execution.source)
                    artifact_list.extend(execution.artifacts)
                    await self._persist_tool(conversation_id, user_message_id, execution, name, arguments, trace_id, contract.query_spec())
                    wants_card = any(w in request.message.lower() for w in ("card", "cards", "grafico", "gráfico", "tabela", "planilha")) or name == "consultar_banco_bi"
                    emitted_arts = [artifact.model_dump() for artifact in execution.artifacts] if wants_card else []
                    await self._emit(on_event, "tool_result", {"label": TOOL_LABELS.get(name, "a fonte do BI"), "status": execution.status, "source": public_source(execution.source).model_dump() if execution.source else None, "artifacts": emitted_arts, "warnings": execution.warnings[:6]})
                    messages.append(tool_result_message(call_id, execution.model_payload()))
                    tool_context.last_sources = list(source_list)
                if limit_reached:
                    break
                continue
            raw_content = assistant.get("content")
            final_answer, raw_choices = parse_final_content(raw_content if isinstance(raw_content, str) else "")
            choices_result = choices(raw_choices)
            if contract.intent == "clarify" and contract.choices:
                choices_result = choices(list(contract.choices))
            if not final_answer and raw_content:
                final_answer = raw_content.strip()
            if not final_answer:
                final_answer = contract.clarification_text or "Não consegui formular uma resposta segura para esta pergunta."
            contract_valid, contract_status = contract_evidence_status(contract, tool_outputs, source_list)
            if any(execution.status == "ok" for execution in tool_outputs):
                contract_valid = True
                contract_status = "passed"
            verification = verify_answer(final_answer, [execution.model_payload() for execution in tool_outputs]) if contract.intent not in {"casual", "clarify", "compatibility"} else None
            valid = contract_valid and (verification.valid if verification else True)
            if not valid and verification_retries == 0 and not any(execution.tool_name == "consultar_banco_bi" for execution in tool_outputs):
                verification_retries += 1
                reason = "números sem evidência" if verification and not verification.valid else "a ferramenta, o período ou os blocos exigidos não foram atendidos"
                messages.append({"role": "system", "content": f"A verificação encontrou {reason}. Refaça a resposta usando somente a evidência da ferramenta desta rodada. Não troque o período e não invente números."})
                continue
            if not valid and not final_answer:
                final_answer = "Não consegui confirmar o recorte solicitado com a fonte oficial nesta rodada. Posso refazer com um período ou detalhe mais específico."
                choices_result = []
            break
        else:
            limit_reached = True

        if limit_reached and not final_answer:
            final_answer = "Não consegui concluir a análise dentro do limite desta pergunta. Tente um período ou recorte menor."
            choices_result = []
        if not final_answer:
            final_answer = contract.clarification_text or "Não encontrei dados suficientes para responder com segurança."
        if contract.intent == "clarify" and not choices_result:
            choices_result = choices(list(contract.choices))
        await self._emit(on_event, "status", {"message": "Preparando a resposta…"})
        await self._emit(on_event, "delta", {"text": final_answer})
        public_sources = [public_source(source) for source in unique_sources(source_list)]
        wants_cards = any(w in request.message.lower() for w in ("card", "cards", "grafico", "gráfico", "tabela", "planilha")) or any(e.tool_name == "consultar_banco_bi" for e in tool_outputs)
        if not wants_cards or not final_answer or "Não consegui" in final_answer:
            public_artifacts = []
        else:
            public_artifacts = unique_artifacts(artifact_list)
        query_spec = {
            **contract.query_spec(),
            "agent_version": "v2",
            "catalog_version": CATALOG_VERSION,
            "domain": contract.domain if contract.domain != "conversation" else active_topic(topic_candidates),
            "source_count": len(public_sources),
            "topics": list(dict.fromkeys(TOOL_LABELS.get(name, "fonte do BI") for name in tool_names)),
            "verification": "passed" if verification_retries == 0 and contract_status in {"passed", "not_required", "clarification"} else "retry_checked",
            "contract_status": contract_status,
        }
        db_ms = sum(int(source.execution_metrics.get("elapsed_ms", 0)) for source in source_list)
        cache_hits = sum(bool(source.execution_metrics.get("cache_hit", False)) for source in source_list)
        await self._emit(on_event, "plan", {"query_spec": query_spec})
        await self._emit(on_event, "sources", {"sources": [source.model_dump() for source in public_sources], "db_ms": db_ms, "cache_hits": cache_hits})
        assistant_message_id = await persist_message(query_async, conversation_id, "assistant", final_answer, query_spec, public_sources, artifacts=[artifact.model_dump() for artifact in public_artifacts], choices=[choice.model_dump() for choice in choices_result], trace_id=trace_id, prompt_version=PROMPT_VERSION, model=last_model)
        state = await update_agent_state(query_async, conversation_id, memory.state, memory.summary, request.message, final_answer, request.context, query_spec, public_sources)
        total_ms = round((time.monotonic() - started) * 1000)
        failure_category = "limit" if limit_reached else ("contract" if contract.requires_evidence and contract_status != "passed" else None)
        stats = {
            "status": "completed",
            "trace_id": trace_id,
            "model": last_model,
            "prompt_version": PROMPT_VERSION,
            "model_rounds": model_rounds,
            "tool_call_count": len(tool_outputs),
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "finish_reasons": finish_reasons,
            "estimated_cost": estimated_cost(input_tokens, output_tokens),
            "memory_context_chars": prompt.memory_chars,
            "artifact_count": len(public_artifacts),
            "provider_ms": provider_ms,
            "total_ms": total_ms,
            "failure_category": failure_category,
            "intent": contract.intent,
            "classifier_status": contract.classifier_status,
            "classifier_rounds": 1 if contract.classifier_status == "model" else 0,
        }
        await persist_agent_turn_metrics(query_async, conversation_id=conversation_id, message_id=assistant_message_id, route=request.context.route, query_spec=query_spec, sources=source_list, db_ms=db_ms, model_ms=provider_ms, total_ms=total_ms, answer_chars=len(final_answer), model_rounds=model_rounds, tool_call_count=len(tool_outputs), input_tokens=input_tokens, output_tokens=output_tokens, estimated_cost=stats["estimated_cost"], memory_context_chars=prompt.memory_chars, artifact_count=len(public_artifacts), trace_id=trace_id, model=last_model, prompt_version=PROMPT_VERSION, status="completed", failure_category=failure_category)
        log_event(logging.INFO, "ai_agent_turn_completed", trace_id=trace_id, user_hash=user_hash(user.id), model_rounds=model_rounds, tool_call_count=len(tool_outputs), total_ms=total_ms)
        return AgentTurnResult(conversation_id=conversation_id, user_message_id=user_message_id, assistant_message_id=assistant_message_id, answer=final_answer, evidence=public_sources, artifacts=public_artifacts, choices=choices_result, query_spec={**query_spec, "state_active_topic": state.get("active_topic")}, stats=stats)

    async def _persist_tool(self, conversation_id: str, message_id: str, execution: ToolExecution, name: str, arguments: Any, trace_id: str, query_spec: dict[str, Any]) -> None:
        try:
            await persist_agent_tool_run(query_async, conversation_id=conversation_id, message_id=message_id, tool_name=name, tool_call_id=execution.tool_call_id, tool_input=safe_tool_input(arguments), result_preview=execution.model_payload(), presentation={"artifact_types": [artifact.type for artifact in execution.artifacts]}, query_spec=query_spec, source=execution.source, elapsed_ms=int(execution.source.execution_metrics.get("elapsed_ms", 0)) if execution.source else 0, status=execution.status, error_category=execution.error_category, started_at=datetime.now(timezone.utc).isoformat(), completed_at=datetime.now(timezone.utc).isoformat())
        except Exception as error:
            log_exception("ai_agent_tool_trace_failed", error, trace_id=trace_id, tool_name=name)

    async def _emit(self, callback: EventCallback | None, event: str, data: dict[str, Any]) -> None:
        if callback:
            await callback(event, data)
