"""Small structured logger for API and data-gateway boundaries."""

from __future__ import annotations

import json
import logging
import re
from typing import Any


_logger = logging.getLogger("ceres-bi-ai")
if not _logger.handlers:
    logging.basicConfig(level=logging.INFO)


_REDACTED = "[redacted]"
_SENSITIVE_KEY = re.compile(
    r"^(?:authorization|cookie|password|secret|token|api[_ -]?key|prompt|payload|"
    r"sql|statement|query|content|error|exception|detail|email|cpf|cnpj|phone|telefone|chassi|serie|documento)$",
    re.IGNORECASE,
)
_SENSITIVE_TEXT = re.compile(
    r"(?:bearer\s+\S+|sk-[a-z0-9_-]{8,}|(?:password|senha|secret|token|api[_ -]?key)\s*[:=]\s*\S+|"
    r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[-.\s]?\d{4})",
    re.IGNORECASE,
)


def _safe_value(key: str, value: Any, depth: int = 0) -> Any:
    if _SENSITIVE_KEY.search(key):
        return _REDACTED
    if depth > 3:
        return "…"
    if isinstance(value, dict):
        return {str(item_key)[:120]: _safe_value(str(item_key), item_value, depth + 1) for item_key, item_value in list(value.items())[:32]}
    if isinstance(value, (list, tuple, set)):
        return [_safe_value(key, item, depth + 1) for item in list(value)[:20]]
    if isinstance(value, str):
        sanitized = _SENSITIVE_TEXT.sub(_REDACTED, value)
        return sanitized[:240]
    return value


def log_event(level: int, event: str, **fields: Any) -> None:
    safe_fields = {key: _safe_value(key, value) for key, value in fields.items()}
    _logger.log(level, json.dumps({"event": event, **safe_fields}, ensure_ascii=False, default=str))


def log_exception(event: str, error: BaseException, **fields: Any) -> None:
    # Do not emit traceback text: database/provider exceptions can include SQL,
    # connection details or user payloads. The type and event are enough for
    # correlation; the external tracker receives the trace id when configured.
    log_event(logging.ERROR, event, error_type=type(error).__name__, error=_REDACTED, **fields)
