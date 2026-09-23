"""Safe, low-overhead observability helpers for BI query events.

Events are emitted as one JSON object per log line.  No filter values, SQL,
tokens or user identifiers are ever included; a hash is used only to group
otherwise equivalent filter shapes in offline baseline reports.
"""

from __future__ import annotations

import calendar
import hashlib
import json
import logging
import re
from datetime import date
from typing import Any
from uuid import uuid4

LOGGER = logging.getLogger("ceresbi.bi")
_REQUEST_ID = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
_ERROR_CODE = re.compile(r"^[A-Z0-9_.-]{1,80}$")


def safe_request_id(value: object | None) -> str:
    """Accept a bounded correlation id or replace untrusted values."""

    candidate = str(value or "")[:128]
    return candidate if _REQUEST_ID.fullmatch(candidate) else str(uuid4())


def period_case(filters: object) -> str:
    """Classify a date filter without logging its values."""

    start = getattr(filters, "from_", None)
    end = getattr(filters, "to", None)
    if not isinstance(start, date) or not isinstance(end, date):
        return "custom"
    if start.year == end.year and start.month == end.month:
        last_day = calendar.monthrange(start.year, start.month)[1]
        if start.day == 1 and end.day == last_day:
            return "monthly"
    if start.year == end.year and start.month == 1 and start.day == 1 and end.month == 12 and end.day == 31:
        return "annual"
    return "custom"


def filter_hash(filters: object) -> str:
    """Return a stable grouping hash without exposing filter contents."""

    try:
        values = filters.model_dump(mode="json", by_alias=True, exclude_none=True)
    except AttributeError:
        values = {}
    encoded = json.dumps(values, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()[:16]


def error_code(error: BaseException) -> str:
    candidate = str(getattr(error, "code", "") or "").upper()[:80]
    return candidate if _ERROR_CODE.fullmatch(candidate) else "BI_QUERY_FAILED"


def payload_size(data: object) -> int:
    """Compute UTF-8 JSON bytes while tolerating Decimal/date-like values."""

    try:
        return len(json.dumps(data, default=str, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    except (TypeError, ValueError):
        return 0


def emit_bi_query(**fields: Any) -> None:
    """Emit a redacted structured event through the service stdout logger."""

    event = {"event": "bi_query", **fields}
    # The application logger is routed to stdout by uvicorn/container logging;
    # JSON is kept as the complete message so collectors can parse one line.
    LOGGER.info(json.dumps(event, sort_keys=True, separators=(",", ":"), ensure_ascii=True))
