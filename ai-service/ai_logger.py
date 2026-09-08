"""Small structured logger for API and data-gateway boundaries."""

from __future__ import annotations

import json
import logging
from typing import Any


_logger = logging.getLogger("ceres-bi-ai")
if not _logger.handlers:
    logging.basicConfig(level=logging.INFO)


def log_event(level: int, event: str, **fields: Any) -> None:
    safe_fields = {
        key: value
        for key, value in fields.items()
        if key.casefold() not in {"authorization", "token", "password", "secret", "api_key", "email", "cpf", "phone"}
    }
    _logger.log(level, json.dumps({"event": event, **safe_fields}, ensure_ascii=False, default=str))


def log_exception(event: str, error: BaseException, **fields: Any) -> None:
    log_event(logging.ERROR, event, error_type=type(error).__name__, error=str(error)[:240], **fields)
    _logger.exception(event)
