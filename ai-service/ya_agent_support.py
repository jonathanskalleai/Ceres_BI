"""Small transport-safe helpers shared by the agent runner and HTTP layer."""

from __future__ import annotations

import hashlib
import json
import logging
import os
from collections import defaultdict, deque
from typing import Any

from fastapi import HTTPException

from ai_logger import log_event
from ya_agent_models import AgentChoice, AgentTurnResult
from ya_agent_tools.common import public_source


REQUEST_LIMIT = 12
REQUEST_WINDOW_SECONDS = 10 * 60
REQUEST_WINDOWS: dict[str, deque[float]] = defaultdict(deque)


def usage_int(usage: Any, *keys: str) -> int:
    if not isinstance(usage, dict):
        return 0
    for key in keys:
        try:
            return max(0, int(usage.get(key) or 0))
        except (TypeError, ValueError) as error:
            log_event(logging.DEBUG, "ai_agent_usage_value_invalid", error_type=type(error).__name__)
    return 0


def call_key(name: str, arguments: Any) -> str:
    try:
        encoded = json.dumps(arguments, ensure_ascii=False, sort_keys=True, default=str)
    except TypeError as error:
        log_event(logging.DEBUG, "ai_agent_call_key_fallback", error_type=type(error).__name__)
        encoded = str(arguments)[:2_000]
    return f"{name}:{encoded}"


def topic_from_tool(name: str, arguments: Any) -> str:
    direct = {
        "consultar_desempenho_vendas": "vendas",
        "consultar_acoes_comerciais": "acoes",
        "consultar_desempenho_equipe": "equipe",
        "consultar_banco_bi": "exploratory",
    }
    if name in direct:
        return direct[name]
    if name in {"guardar_memoria_usuario", "esquecer_memoria_usuario", "explicar_conceito", "consultar_atualizacao"}:
        return "conversation"
    if isinstance(arguments, dict):
        domain = arguments.get("dominio")
        if isinstance(domain, str) and domain in {"vendas", "acoes", "equipe"}:
            return domain
        for key in ("metrica", "metrica_a", "metrica_b"):
            metric = arguments.get(key)
            if isinstance(metric, str) and metric.split(".", 1)[0] in {"vendas", "acoes", "equipe"}:
                return metric.split(".", 1)[0]
    return "conversation"


def active_topic(candidates: list[str]) -> str:
    for topic in reversed(candidates):
        if topic in {"vendas", "acoes", "equipe", "exploratory"}:
            return topic
    return "conversation"


def safe_tool_input(arguments: Any) -> dict[str, Any]:
    if not isinstance(arguments, dict):
        return {"invalid": True}
    output = dict(arguments)
    if "sql" in output:
        sql = str(output.pop("sql") or "")
        output["query_hash"] = hashlib.sha256(sql.encode("utf-8")).hexdigest()
    return safe_json(output)


def safe_json(value: Any, depth: int = 0) -> Any:
    if depth > 4:
        return "…"
    if isinstance(value, dict):
        return {str(key)[:120]: safe_json(item, depth + 1) for key, item in list(value.items())[:32]}
    if isinstance(value, list):
        return [safe_json(item, depth + 1) for item in value[:20]]
    if isinstance(value, str):
        return value[:500]
    return value


def unique_sources(sources: list[Any]) -> list[Any]:
    output, seen = [], set()
    for source in sources:
        if source.id not in seen:
            seen.add(source.id)
            output.append(source)
    return output


def unique_artifacts(artifacts: list[Any]) -> list[Any]:
    output, seen = [], set()
    for artifact in artifacts:
        key = json.dumps(artifact.model_dump(), ensure_ascii=False, sort_keys=True, default=str)
        if key not in seen:
            seen.add(key)
            output.append(artifact)
    return output[:12]


def choices(items: list[dict[str, str]]) -> list[AgentChoice]:
    output: list[AgentChoice] = []
    for item in items[:6]:
        try:
            output.append(AgentChoice.model_validate(item))
        except ValueError as error:
            log_event(logging.DEBUG, "ai_agent_choice_rejected", error_type=type(error).__name__)
    return output


def estimated_cost(input_tokens: int, output_tokens: int) -> float | None:
    try:
        input_rate = float(os.getenv("YA_AGENT_INPUT_USD_PER_1K", "0"))
        output_rate = float(os.getenv("YA_AGENT_OUTPUT_USD_PER_1K", "0"))
    except ValueError as error:
        log_event(logging.WARNING, "ai_agent_cost_configuration_invalid", error_type=type(error).__name__)
        return None
    if input_rate == 0 and output_rate == 0:
        return None
    return round((input_tokens / 1000) * input_rate + (output_tokens / 1000) * output_rate, 8)


def user_hash(user_id: str) -> str:
    return hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:16]


def ensure_rate_limit(user_id: str, now: float) -> None:
    window = REQUEST_WINDOWS[user_id]
    while window and window[0] <= now - REQUEST_WINDOW_SECONDS:
        window.popleft()
    if len(window) >= REQUEST_LIMIT:
        raise HTTPException(status_code=429, detail="Limite temporário de perguntas atingido. Tente novamente em alguns minutos.")
    window.append(now)


def sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


def result_payload(result: AgentTurnResult) -> dict[str, Any]:
    from datetime import datetime, timezone

    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    evidence = [public_source(source).model_dump() for source in result.evidence]
    return {
        "conversation_id": result.conversation_id,
        "assistant_message_id": result.assistant_message_id,
        "answer": result.answer,
        "sources": evidence,
        "evidence": evidence,
        "artifacts": [artifact.model_dump() for artifact in result.artifacts],
        "choices": [choice.model_dump() for choice in result.choices],
        "query_spec": result.query_spec,
        "stats": result.stats,
        "generated_at": generated_at,
    }
