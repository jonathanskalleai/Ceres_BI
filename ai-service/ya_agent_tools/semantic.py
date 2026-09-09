"""Non-numeric semantic and freshness tools."""

from __future__ import annotations

from typing import Any

from ya_agent_catalog import get_agent_metric, metric_payload
from ya_agent_models import ExplainToolInput, FreshnessToolInput
from ya_agent_tools.common import ToolContext, compact_result, source_for
from ya_agent_tools.official import _freshness


async def execute_explain(context: ToolContext, input_data: ExplainToolInput, call_id: str):
    metric = get_agent_metric(input_data.metrica)
    source_id = f"conceito:{context.conversation_id}:{call_id}"
    if not metric:
        warning = "Esse conceito ainda não está no catálogo oficial inicial."
        source = source_for(source_id=source_id, label="Conceito do BI", intent="agent_tool", metric_definitions=[], period=None, filters={}, warnings=[warning], lineage_executor="semantic_catalog")
        return _Result({"status": "blocked", "motivo": warning}, source, [], [warning])
    definition = metric_payload(metric.id) or {}
    data = compact_result({
        "status": "computed",
        "metrica": metric.id,
        "nome": metric.label,
        "definicao": metric.description,
        "unidade": metric.unit,
        "entidade": metric.entity,
        "grao": metric.grain,
        "competencia": metric.competence,
        "deduplicacao": metric.deduplication,
        "formula": metric.formula,
        "exclusoes": metric.exclusions,
        "filtros": list(metric.filters),
        "dimensoes": list(metric.dimensions),
        "evidencia_referenciada": [source.id for source in context.last_sources if not input_data.source_ids or source.id in input_data.source_ids],
    })
    source = source_for(source_id=source_id, label="Conceito do BI", intent="agent_tool", metric_definitions=[definition], period=None, filters={}, warnings=[], lineage_executor="semantic_catalog")
    return _Result(data, source, [], [])


async def execute_freshness(context: ToolContext, input_data: FreshnessToolInput, call_id: str):
    refreshed_at, freshness = await _freshness(context)
    source_id = f"atualizacao:{context.conversation_id}:{call_id}"
    data = {
        "status": "computed" if refreshed_at or freshness.get("status") != "não informado" else "unavailable",
        "dominio": input_data.dominio or "fontes iniciais",
        "atualizacao": freshness,
        "nao_confundir_com": "A atualização da base não muda a competência do indicador consultado.",
    }
    source = source_for(source_id=source_id, label="Atualização das fontes", intent="agent_tool", metric_definitions=[], period=None, filters={}, warnings=[] if refreshed_at else ["A fonte de atualização não informou data/hora nesta rodada."], refreshed_at=refreshed_at, lineage_executor="etl_status")
    return _Result(compact_result(data), source, [], source.warnings)


class _Result:
    def __init__(self, data: dict[str, Any], source: Any, artifacts: list[Any], warnings: list[str]):
        self.data = data
        self.source = source
        self.artifacts = artifacts
        self.warnings = warnings
