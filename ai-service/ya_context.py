"""Permanent product context used by the planner and conversational narrator."""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

from ai_logger import log_event


CONTEXT_PATH = Path(__file__).with_name("YA_CONTEXT.md")
MAX_CONTEXT_CHARS = 14_000


@lru_cache(maxsize=1)
def product_context() -> str:
    try:
        content = CONTEXT_PATH.read_text(encoding="utf-8").strip()
    except OSError as error:
        log_event(logging.ERROR, "ai_product_context_unavailable", error_type=type(error).__name__)
        return "Contexto permanente indisponível. Use somente as fontes e evidências retornadas nesta rodada."
    return content[:MAX_CONTEXT_CHARS]
