"""Public request and response contracts for the BI API."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field


class BiIssue(BaseModel):
    code: str
    message: str
    source: str | None = None


class BiEnvelope(BaseModel):
    status: Literal["ok", "partial", "error"]
    data: Any = None
    issues: list[BiIssue] = Field(default_factory=list)
    requestId: str
    fetchedAt: str

    @classmethod
    def success(cls, data: Any, request_id: str | None = None) -> "BiEnvelope":
        return cls(
            status="ok",
            data=data,
            requestId=request_id or str(uuid4()),
            fetchedAt=datetime.now(timezone.utc).isoformat(),
        )

    @classmethod
    def failure(cls, request_id: str, *, message: str, code: str = "BI_QUERY_FAILED") -> "BiEnvelope":
        return cls(
            status="error",
            issues=[BiIssue(code=code, message=message)],
            requestId=request_id,
            fetchedAt=datetime.now(timezone.utc).isoformat(),
        )


class AcoesFilters(BaseModel):
    from_: date | None = Field(default=None, alias="from")
    to: date | None = None
    vendedor: str | None = None
    tipoAcao: str | None = None
    cidade: str | None = None

    model_config = {"populate_by_name": True}


class AcoesDetalheFilters(AcoesFilters):
    statusNegocio: str | None = None
    limit: int = Field(default=50, ge=1, le=5000)
    offset: int = Field(default=0, ge=0)
