"""Shared memory serializers and query typing without feature-module imports."""

from __future__ import annotations

import json
import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Awaitable, Callable

from ai_logger import log_event
from ya_models import YaContext, YaSource


THREAD_SUMMARY_MAX_CHARS = 3_200
QueryFn = Callable[[str, tuple[Any, ...]], Awaitable[list[dict[str, Any]]]]


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


def next_summary(previous: str, message: str, answer: str, context: YaContext) -> str:
    filters = context.filters.model_dump(by_alias=True, exclude_none=True)
    context_note = ", ".join(f"{key}={value}" for key, value in filters.items()) or "filtros da tela"
    fragment = f"\n- Pergunta: {message[:420]}\n  Resposta: {answer[:720]}\n  Contexto: {context_note}"
    return (previous.strip() + fragment)[-THREAD_SUMMARY_MAX_CHARS:]
