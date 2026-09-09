"""Strict tool schemas and dispatch for the v2 agent."""

from __future__ import annotations

import logging
from typing import Any, Type

from pydantic import BaseModel, ValidationError

from ai_logger import log_event, log_exception
from ya_agent_models import (
    ActionsToolInput,
    AgentArtifact,
    CompareToolInput,
    CorrelationToolInput,
    ExplainToolInput,
    ExploratoryToolInput,
    ForgetMemoryToolInput,
    FreshnessToolInput,
    SaveMemoryToolInput,
    SalesToolInput,
    TeamToolInput,
    ToolCall,
    ToolExecution,
)
from ya_agent_tools.analysis import execute_compare, execute_correlation
from ya_agent_tools.common import ToolContext, ToolInputError, ToolUnavailable, compact_result
from ya_agent_tools.exploratory import execute_exploratory
from ya_agent_tools.memory import execute_forget_memory, execute_save_memory
from ya_agent_tools.official import execute_actions, execute_sales, execute_team
from ya_agent_tools.semantic import execute_explain, execute_freshness


TOOL_LABELS = {
    "consultar_desempenho_vendas": "desempenho de vendas",
    "consultar_acoes_comerciais": "ações comerciais",
    "consultar_desempenho_equipe": "desempenho da equipe",
    "comparar_periodos": "comparação entre períodos",
    "consultar_banco_bi": "análise exploratória",
    "correlacionar_metricas": "associação entre métricas",
    "explicar_conceito": "conceito do indicador",
    "consultar_atualizacao": "atualização das fontes",
    "guardar_memoria_usuario": "memória do usuário",
    "esquecer_memoria_usuario": "memória do usuário",
}

TOOL_MODELS: dict[str, Type[BaseModel]] = {
    "consultar_desempenho_vendas": SalesToolInput,
    "consultar_acoes_comerciais": ActionsToolInput,
    "consultar_desempenho_equipe": TeamToolInput,
    "comparar_periodos": CompareToolInput,
    "consultar_banco_bi": ExploratoryToolInput,
    "correlacionar_metricas": CorrelationToolInput,
    "explicar_conceito": ExplainToolInput,
    "consultar_atualizacao": FreshnessToolInput,
    "guardar_memoria_usuario": SaveMemoryToolInput,
    "esquecer_memoria_usuario": ForgetMemoryToolInput,
}

TOOL_DESCRIPTIONS = {
    "consultar_desempenho_vendas": "Consulte vendas, faturamento, ticket, perdas, rankings e produtos com o conceito oficial.",
    "consultar_acoes_comerciais": "Consulte ações, visitas, oportunidades, funil e ganhos/perdas ligados à área de Ações.",
    "consultar_desempenho_equipe": "Consulte vendas, faturamento, metas, ticket e conversão por consultor e mês.",
    "comparar_periodos": "Compare dois períodos com os mesmos filtros e cálculos feitos no backend.",
    "consultar_banco_bi": "Faça uma investigação read-only quando nenhum contrato oficial responder à pergunta.",
    "correlacionar_metricas": "Calcule uma associação observada entre duas métricas pareáveis; nunca causalidade.",
    "explicar_conceito": "Explique a definição, competência, fórmula, deduplicação e exclusões de um indicador.",
    "consultar_atualizacao": "Consulte a atualização da carga sem confundi-la com a competência do indicador.",
    "guardar_memoria_usuario": "Guarde somente uma preferência ou fato pessoal explicitamente confirmado pelo usuário.",
    "esquecer_memoria_usuario": "Esqueça uma memória duradoura do usuário atual, com soft-delete auditável.",
}

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": name,
            "description": TOOL_DESCRIPTIONS[name],
            "parameters": model.model_json_schema(),
            "strict": True,
        },
    }
    for name, model in TOOL_MODELS.items()
]


async def dispatch_tool(tool_call: ToolCall, context: ToolContext) -> ToolExecution:
    model = TOOL_MODELS.get(tool_call.name)
    if model is None:
        return _error_execution(tool_call, "validation", "Ferramenta não disponível.")
    try:
        if not isinstance(tool_call.arguments, dict):
            raise ToolInputError("Os argumentos da ferramenta precisam ser um objeto.")
        input_data = model.model_validate(tool_call.arguments)
        _validate_metric_references(tool_call.name, input_data)
    except (ValidationError, ToolInputError, ValueError) as error:
        log_event(logging.WARNING, "ai_agent_tool_input_rejected", tool_name=tool_call.name, error_type=type(error).__name__)
        return _error_execution(tool_call, "validation", "Não consegui interpretar os filtros desta consulta.")
    try:
        result = await _executor_for(tool_call.name)(context, input_data, tool_call.call_id)
        artifacts = [artifact if isinstance(artifact, AgentArtifact) else AgentArtifact.model_validate(artifact) for artifact in getattr(result, "artifacts", [])[:12]]
        return ToolExecution(
            tool_name=tool_call.name,
            tool_call_id=tool_call.call_id,
            data=compact_result(getattr(result, "data", {})),
            source=getattr(result, "source", None),
            artifacts=artifacts,
            warnings=list(getattr(result, "warnings", []))[:12],
            status="ok",
        )
    except ToolUnavailable as error:
        log_event(logging.WARNING, "ai_agent_tool_unavailable", tool_name=tool_call.name, error_type=type(error).__name__)
        return _error_execution(tool_call, "source_unavailable", "A fonte necessária não respondeu ou não possui o contrato solicitado.")
    except Exception as error:
        log_exception("ai_agent_tool_failed", error, tool_name=tool_call.name)
        return _error_execution(tool_call, "execution", "Não consegui concluir esta consulta agora; posso tentar um recorte menor.")


def _executor_for(name: str):
    return {
        "consultar_desempenho_vendas": execute_sales,
        "consultar_acoes_comerciais": execute_actions,
        "consultar_desempenho_equipe": execute_team,
        "comparar_periodos": execute_compare,
        "consultar_banco_bi": execute_exploratory,
        "correlacionar_metricas": execute_correlation,
        "explicar_conceito": execute_explain,
        "consultar_atualizacao": execute_freshness,
        "guardar_memoria_usuario": execute_save_memory,
        "esquecer_memoria_usuario": execute_forget_memory,
    }[name]


def _validate_metric_references(name: str, input_data: BaseModel) -> None:
    from ya_agent_catalog import get_agent_metric

    values: list[str] = []
    if name == "comparar_periodos":
        values = list(getattr(input_data, "metricas", []))
    elif name == "correlacionar_metricas":
        values = [getattr(input_data, "metrica_a", ""), getattr(input_data, "metrica_b", "")]
    elif name == "explicar_conceito":
        values = [getattr(input_data, "metrica", "")]
    for value in values:
        metric = get_agent_metric(value)
        if not metric:
            raise ToolInputError("A métrica não está no catálogo inicial.")
        if name == "comparar_periodos" and metric.domain != getattr(input_data, "dominio", None):
            raise ToolInputError("As métricas da comparação precisam pertencer ao domínio escolhido.")
    if name in {"consultar_acoes_comerciais", "comparar_periodos"} and getattr(input_data, "dominio", "acoes") == "acoes":
        filters = getattr(input_data, "filtros", None)
        if filters and any(value not in (None, "") for key, value in filters.model_dump().items() if key not in {"vendedor", "cidade"}):
            raise ToolInputError("A área de Ações aceita apenas vendedor e cidade neste escopo.")


def _error_execution(tool_call: ToolCall, category: str, message: str) -> ToolExecution:
    return ToolExecution(
        tool_name=tool_call.name,
        tool_call_id=tool_call.call_id,
        data={"status": "error", "error": {"category": category, "message": message}},
        warnings=[message],
        status="error",
        error_category=category,
    )


class AgentToolRegistry:
    """Small façade used by the runner and easy to replace in unit tests."""

    definitions = TOOL_DEFINITIONS

    async def execute(self, tool_call: ToolCall, context: ToolContext) -> ToolExecution:
        return await dispatch_tool(tool_call, context)
