"""Strict contracts used by the iterative conversational BI agent."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ya_models import YaSource


FunnelMode = Literal["padrao", "todos", "somente_repasse", "selecionados"]
Presentation = Literal["texto", "tabela", "barras", "linha", "kpi_group"]
SalesBlock = Literal["kpis", "serie", "rankings", "perdas", "produtos", "resumo"]
ActionBlock = Literal["resumo", "visitas", "funil", "ranking", "evolucao", "ganhos", "perdas", "detalhes"]
TeamIndicator = Literal[
    "vendas", "faturamento", "ticket_medio", "meta", "conversao",
    "negocios", "oportunidades_abertas",
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ToolFilters(StrictModel):
    vendedor: str | None = Field(default=None, max_length=120)
    cidade: str | None = Field(default=None, max_length=120)
    produto: str | None = Field(default=None, max_length=120)
    condicao: str | None = Field(default=None, max_length=120)
    origem: str | None = Field(default=None, max_length=120)
    banco: str | None = Field(default=None, max_length=120)
    motivo_perda: str | None = Field(default=None, max_length=120)


class DateRangeInput(StrictModel):
    periodo_inicio: date
    periodo_fim: date

    @model_validator(mode="after")
    def validate_period(self) -> "DateRangeInput":
        if self.periodo_inicio > self.periodo_fim:
            raise ValueError("periodo_inicio deve ser anterior ou igual a periodo_fim")
        return self


class SalesToolInput(DateRangeInput):
    filtros: ToolFilters = Field(default_factory=ToolFilters)
    modo_funil: FunnelMode = "padrao"
    funis_selecionados: list[str] = Field(default_factory=list, max_length=10)
    blocos: list[SalesBlock] = Field(default_factory=lambda: ["kpis"], max_length=6)
    apresentacao: Presentation = "kpi_group"


class ActionsToolInput(DateRangeInput):
    filtros: ToolFilters = Field(default_factory=ToolFilters)
    tipo_acao: str | None = Field(default=None, max_length=120)
    modo_funil: FunnelMode = "padrao"
    funis_selecionados: list[str] = Field(default_factory=list, max_length=10)
    blocos: list[ActionBlock] = Field(default_factory=lambda: ["resumo"], max_length=8)
    apresentacao: Presentation = "kpi_group"


class TeamToolInput(StrictModel):
    ano: int = Field(ge=2020, le=2100)
    meses: list[int] = Field(default_factory=list, max_length=12)
    consultor: str | None = Field(default=None, max_length=120)
    cidade: str | None = Field(default=None, max_length=120)
    indicadores: list[TeamIndicator] = Field(default_factory=lambda: ["vendas"], max_length=7)
    apresentacao: Presentation = "tabela"

    @model_validator(mode="after")
    def validate_months(self) -> "TeamToolInput":
        if any(month < 1 or month > 12 for month in self.meses):
            raise ValueError("meses deve conter valores entre 1 e 12")
        self.meses = list(dict.fromkeys(self.meses))
        return self


class CompareToolInput(StrictModel):
    dominio: Literal["vendas", "acoes", "equipe"]
    metricas: list[str] = Field(min_length=1, max_length=4)
    periodo_atual_inicio: date
    periodo_atual_fim: date
    periodo_base_inicio: date
    periodo_base_fim: date
    filtros: ToolFilters = Field(default_factory=ToolFilters)
    modo_funil: FunnelMode = "padrao"
    funis_selecionados: list[str] = Field(default_factory=list, max_length=10)
    apresentacao: Presentation = "kpi_group"

    @model_validator(mode="after")
    def validate_periods(self) -> "CompareToolInput":
        if self.periodo_atual_inicio > self.periodo_atual_fim:
            raise ValueError("período atual inválido")
        if self.periodo_base_inicio > self.periodo_base_fim:
            raise ValueError("período base inválido")
        return self


class ExploratoryToolInput(StrictModel):
    objetivo: str = Field(min_length=3, max_length=500)
    sql: str = Field(min_length=1, max_length=14_000)
    apresentacao: Presentation = "tabela"


class CorrelationToolInput(DateRangeInput):
    metrica_a: str = Field(min_length=1, max_length=120)
    metrica_b: str = Field(min_length=1, max_length=120)
    granularidade: Literal["consultor", "cidade", "mes"]
    filtros: ToolFilters = Field(default_factory=ToolFilters)
    metodo: Literal["pearson"] = "pearson"
    limite_outliers: int = Field(default=5, ge=0, le=20)


class ExplainToolInput(StrictModel):
    metrica: str = Field(min_length=1, max_length=120)
    source_ids: list[str] = Field(default_factory=list, max_length=5)


class FreshnessToolInput(StrictModel):
    dominio: Literal["vendas", "acoes", "equipe"] | None = None


class SaveMemoryToolInput(StrictModel):
    chave: str = Field(min_length=1, max_length=120)
    categoria: Literal["identity", "preference", "business_choice", "context"]
    conteudo: str = Field(min_length=1, max_length=1_000)
    confirmado: bool = False


class ForgetMemoryToolInput(StrictModel):
    chave: str = Field(min_length=1, max_length=120)


@dataclass(frozen=True)
class ToolCall:
    call_id: str
    name: str
    arguments: dict[str, Any]


class ArtifactColumn(StrictModel):
    key: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=120)


class AgentArtifact(StrictModel):
    type: Literal["table", "bar", "line", "kpi_group", "choices"]
    title: str = Field(min_length=1, max_length=160)
    columns: list[ArtifactColumn] = Field(default_factory=list, max_length=24)
    rows: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    x_key: str | None = Field(default=None, max_length=80)
    series: list[dict[str, Any]] = Field(default_factory=list, max_length=12)
    source_ids: list[str] = Field(default_factory=list, max_length=12)


class AgentChoice(StrictModel):
    label: str = Field(min_length=1, max_length=120)
    value: str = Field(min_length=1, max_length=500)


@dataclass
class ToolExecution:
    tool_name: str
    tool_call_id: str
    data: dict[str, Any]
    source: YaSource | None = None
    artifacts: list[AgentArtifact] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    status: Literal["ok", "error", "blocked"] = "ok"
    error_category: str | None = None

    def model_payload(self) -> dict[str, Any]:
        payload: dict[str, Any] = {"status": self.status, "data": self.data}
        if self.source:
            # The model needs the business definition and applied scope, not
            # implementation lineage.  Keeping executor/table names out of
            # this payload also makes prompt injection through metadata less
            # useful.
            payload["evidence"] = {
                "id": self.source.id,
                "label": self.source.label,
                "filters": self.source.filters,
                "requested_filters": self.source.requested_filters,
                "refreshed_at": self.source.refreshed_at,
                "intent": self.source.intent,
                "metric_definitions": [
                    {
                        key: value
                        for key, value in item.items()
                        if key not in {"executor", "dimension_paths", "drilldown"}
                    }
                    for item in self.source.metric_definitions
                ],
                "applied_scope": self.source.applied_scope,
                "freshness": self.source.freshness,
                "warnings": self.source.warnings,
                "execution_metrics": {
                    key: value
                    for key, value in self.source.execution_metrics.items()
                    if key not in {"query_hash", "sql", "statement"}
                },
            }
        if self.artifacts:
            payload["artifacts"] = [artifact.model_dump() for artifact in self.artifacts]
        if self.warnings:
            payload["warnings"] = self.warnings[:12]
        if self.error_category:
            payload["error_category"] = self.error_category
        return payload


@dataclass
class AgentTurnResult:
    conversation_id: str
    user_message_id: str
    assistant_message_id: str
    answer: str
    evidence: list[YaSource]
    artifacts: list[AgentArtifact]
    choices: list[AgentChoice]
    query_spec: dict[str, Any]
    stats: dict[str, Any]
