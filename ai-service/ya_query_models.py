"""Pydantic contracts shared by semantic planning and the data gateway."""

from __future__ import annotations

from datetime import date
from typing import Any, Optional

from pydantic import BaseModel, Field

from ya_catalog import CATALOG_VERSION


class PeriodSpec(BaseModel):
    from_date: date = Field(alias="from")
    to_date: date = Field(alias="to")
    timezone: str = "America/Sao_Paulo"

    model_config = {"populate_by_name": True}


class ComparisonSpec(BaseModel):
    kind: str = "previous_equivalent"
    baseline: PeriodSpec
    label: str = "período anterior equivalente"


class QuerySpec(BaseModel):
    intent: str
    domain: str
    metrics: list[str] = Field(default_factory=list, max_length=2)
    period: Optional[PeriodSpec] = None
    comparison: Optional[ComparisonSpec] = None
    filters: dict[str, Any] = Field(default_factory=dict)
    requested_filters: dict[str, Any] = Field(default_factory=dict)
    dimensions: list[str] = Field(default_factory=list, max_length=2)
    order_by: Optional[str] = None
    limit: int = Field(default=10, ge=1, le=50)
    entity: Optional[dict[str, str]] = None
    output: str = "metric"
    drilldown_ref: Optional[str] = None
    warnings: list[str] = Field(default_factory=list)
    filter_origins: dict[str, str] = Field(default_factory=dict)
    clarification: Optional[str] = None
    catalog_version: str = CATALOG_VERSION
