"""Bounded, rate-limited ingestion for redacted browser error events."""

from __future__ import annotations

import hashlib
import logging
import time
from collections import OrderedDict, deque
from datetime import datetime
from typing import TypeAlias

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

from ai_logger import log_event


TelemetryValue: TypeAlias = str | int | float | bool | None


class ClientTelemetryPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event: str = Field(min_length=1, max_length=120)
    error: str = Field(min_length=1, max_length=240)
    fields: dict[str, TelemetryValue] = Field(default_factory=dict)
    at: datetime

    @field_validator("fields")
    @classmethod
    def validate_fields(cls, fields: dict[str, TelemetryValue]) -> dict[str, TelemetryValue]:
        if len(fields) > 12:
            raise ValueError("fields exceeds the 12-item limit")
        for key, value in fields.items():
            if len(key) > 60:
                raise ValueError("field key exceeds 60 characters")
            if isinstance(value, str) and len(value) > 240:
                raise ValueError("field value exceeds 240 characters")
        return fields


class TelemetryRateLimiter:
    def __init__(self, limit: int = 30, window_seconds: int = 60, max_clients: int = 1_000):
        self.limit = limit
        self.window_seconds = window_seconds
        self.max_clients = max_clients
        self.windows: OrderedDict[str, deque[float]] = OrderedDict()

    def check(self, client_key: str) -> None:
        now = time.monotonic()
        window = self.windows.setdefault(client_key, deque())
        self.windows.move_to_end(client_key)
        while window and window[0] <= now - self.window_seconds:
            window.popleft()
        if len(window) >= self.limit:
            raise HTTPException(status_code=429, detail="Limite temporário de telemetria atingido.")
        window.append(now)
        while len(self.windows) > self.max_clients:
            self.windows.popitem(last=False)


router = APIRouter(prefix="/telemetry", tags=["client-telemetry"])
rate_limiter = TelemetryRateLimiter()


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def ingest_client_telemetry(payload: ClientTelemetryPayload, request: Request) -> dict[str, bool]:
    # Deliberately works before authentication so login/session failures are
    # observable. The route accepts no credentials or business data, bounds
    # every field, redacts again at the logger boundary, and rate-limits writes.
    host = request.client.host if request.client else "unknown"
    client_key = hashlib.sha256(host.encode("utf-8")).hexdigest()[:20]
    rate_limiter.check(client_key)
    log_event(
        logging.ERROR,
        "client_error_reported",
        client_event=payload.event,
        client_message=payload.error,
        client_fields=payload.fields,
        occurred_at=payload.at.isoformat(),
    )
    return {"accepted": True}
