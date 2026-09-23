"""Public request and response contracts for the BI API."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field, model_validator


class BiIssue(BaseModel):
    code: str
    message: str
    source: str | None = None


class BiMetrics(BaseModel):
    """Timing and payload metadata safe for client-side performance analysis."""

    query_ms: float | None = None
    api_ms: float | None = None
    frontend_ms: float | None = None
    payload_bytes: int | None = None


class BiEnvelope(BaseModel):
    status: Literal["ok", "partial", "error"]
    data: Any = None
    issues: list[BiIssue] = Field(default_factory=list)
    requestId: str
    fetchedAt: str
    metrics: BiMetrics | None = None

    @classmethod
    def success(
        cls,
        data: Any,
        request_id: str | None = None,
        metrics: BiMetrics | None = None,
    ) -> BiEnvelope:
        return cls(
            status="ok",
            data=data,
            requestId=request_id or str(uuid4()),
            fetchedAt=datetime.now(timezone.utc).isoformat(),
            metrics=metrics,
        )

    @classmethod
    def failure(
        cls,
        request_id: str,
        *,
        message: str,
        code: str = "BI_QUERY_FAILED",
        metrics: BiMetrics | None = None,
    ) -> BiEnvelope:
        return cls(
            status="error",
            issues=[BiIssue(code=code, message=message)],
            requestId=request_id,
            fetchedAt=datetime.now(timezone.utc).isoformat(),
            metrics=metrics,
        )


class AcoesFilters(BaseModel):
    from_: date | None = Field(default=None, alias="from")
    to: date | None = None
    vendedor: str | None = Field(default=None, max_length=160)
    tipoAcao: str | None = Field(default=None, max_length=160)
    cidade: str | None = Field(default=None, max_length=160)

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def validate_period(self) -> AcoesFilters:
        if self.from_ and self.to and self.from_ > self.to:
            raise ValueError("from não pode ser posterior a to")
        return self


class AcoesDetalheFilters(AcoesFilters):
    statusNegocio: str | None = Field(default=None, max_length=80)
    limit: int = Field(default=50, ge=1, le=5000)
    offset: int = Field(default=0, ge=0)


class BiRpcRequest(BaseModel):
    params: dict[str, Any] = Field(default_factory=dict)
