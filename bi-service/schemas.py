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
    cache_hit: bool | None = None


class BiSnapshot(BaseModel):
    """Publication metadata shared by Import/Hybrid dashboard responses.

    The fields are optional so existing RPC responses remain wire-compatible
    while read-model-backed dashboards are migrated incrementally.
    """

    model: str | None = None
    version: str | None = None
    snapshot_at: str | None = None
    status: Literal["ready", "refreshing", "stale", "error"] | None = None
    is_stale: bool | None = None
    source: Literal["read_model", "direct_query", "rpc"] | None = None


class BiEnvelope(BaseModel):
    status: Literal["ok", "partial", "error"]
    data: Any = None
    issues: list[BiIssue] = Field(default_factory=list)
    requestId: str
    fetchedAt: str
    metrics: BiMetrics | None = None
    snapshot: BiSnapshot | None = None

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


class PanelFilters(BaseModel):
    """Filters for the server-composed panel KPI contract."""

    from_: date = Field(alias="from")
    to: date
    funis: list[str] = Field(default_factory=list, max_length=100)
    vendedor: str | None = Field(default=None, max_length=160)
    cidade: str | None = Field(default=None, max_length=160)

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def validate_period(self) -> PanelFilters:
        if self.from_ > self.to:
            raise ValueError("from não pode ser posterior a to")
        if any(len(funil) > 160 for funil in self.funis):
            raise ValueError("funis excede o limite de tamanho")
        return self


def _default_read_model_from() -> date:
    current = datetime.now(timezone.utc).date()
    return current.replace(year=current.year - 2)


class ReadModelFilters(BaseModel):
    """Bounded filters for the physical dashboard read-model endpoint."""

    from_: date = Field(default_factory=_default_read_model_from, alias="from")
    to: date = Field(default_factory=lambda: datetime.now(timezone.utc).date())
    vendedor: str | None = Field(default=None, max_length=160)
    cidade: str | None = Field(default=None, max_length=160)
    limit: int = Field(default=5000, ge=1, le=10000)
    offset: int = Field(default=0, ge=0, le=100000)

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def validate_period(self) -> ReadModelFilters:
        if self.from_ > self.to:
            raise ValueError("from não pode ser posterior a to")
        return self


class BiRpcRequest(BaseModel):
    params: dict[str, Any] = Field(default_factory=dict)
