"""Official read-only tools for Sales, Actions and Team dashboards."""

from __future__ import annotations

import logging
import time
from typing import Any

from ai_logger import log_event
from ya_agent_catalog import get_agent_metric, metric_payload
from ya_agent_models import ActionsToolInput, SalesToolInput, TeamToolInput, ToolFilters
from ya_agent_runtime import RuntimeFunctionUnavailable, RuntimeRpcAdapter
from ya_agent_tools.common import (
    ToolContext,
    ToolUnavailable,
    compact_result,
    decode_payload,
    filters_payload,
    first_number,
    find_value,
    funnel_scope,
    list_value,
    now_elapsed,
    source_for,
    table_artifact,
)
from ya_agent_tools.sales_artifacts import build_sales_artifacts
from ya_agent_tools.official_helpers import count_nested_rows, drop_unselected, team_rows, team_totals


SALES_RPC = "rpc_desempenho_vendas_bi"
ACTION_SUMMARY_RPCS = ("rpc_acoes_bi_periodo", "rpc_acoes_bi")
ACTION_FUNNEL_RPCS = ("rpc_acoes_funil_gestao_periodo", "rpc_acoes_funil_gestao")
ACTION_VISIT_SERIES_RPC = "rpc_acoes_visitas_mensal"
ACTION_DETAIL_RPC = "rpc_acoes_detalhe"
TEAM_RPC = "rpc_equipe_desempenho_mensal_v2"


def _rpc_values(start: str, end: str, filters: ToolFilters, *, funis: list[str] | None = None, tipo_acao: str | None = None) -> dict[str, tuple[Any, str]]:
    values: dict[str, tuple[Any, str]] = {
        "p_from": (start, "date"),
        "p_to": (end, "date"),
        "p_ano": (None, "integer"),
        "p_vendedor": (filters.vendedor, "text"),
        "p_vendedor_nome": (filters.vendedor, "text"),
        "p_consultor": (filters.vendedor, "text"),
        "p_cidade": (filters.cidade, "text"),
        "p_condicao": (filters.condicao, "text"),
        "p_produto": (filters.produto, "text"),
        "p_origem": (filters.origem, "text"),
        "p_banco": (filters.banco, "text"),
        "p_motivo_perda": (filters.motivo_perda, "text"),
        "p_tipo_acao": (tipo_acao, "text"),
        "p_limit": (100, "integer"),
        "p_offset": (0, "integer"),
        "p_funis": (funis, "text[]"),
    }
    return values


def _metric_ids_for_sales(blocks: list[str]) -> list[str]:
    ids = ["vendas.faturamento", "vendas.pedidos_aprovados", "vendas.ticket_medio"]
    if any(block in blocks for block in ("perdas", "resumo")):
        ids.extend(["vendas.valor_perdido", "vendas.negocios_perdidos"])
    if "rankings" in blocks:
        ids.append("vendas.faturamento")
    return list(dict.fromkeys(ids))


def _metric_defs(ids: list[str]) -> list[dict[str, Any]]:
    return [definition for item in ids if (definition := metric_payload(item))]


def _freshness_payload(raw: Any) -> tuple[str | None, dict[str, Any]]:
    payload = decode_payload(raw)
    if not isinstance(payload, dict):
        return None, {"status": "não informado"}
    refreshed = find_value(payload, ("refreshed_at",), ("refreshedAt",), ("updated_at",), ("updatedAt",), ("last_sync",), ("lastSync",))
    status = find_value(payload, ("status",), ("sync_status",), ("syncStatus",))
    return (str(refreshed) if refreshed else None), {"status": str(status or "carga disponível"), "refreshed_at": str(refreshed) if refreshed else None}


async def _freshness(context: ToolContext) -> tuple[str | None, dict[str, Any]]:
    adapter = RuntimeRpcAdapter(context.analytical_query)
    try:
        payload = await adapter.call("rpc_etl_status", {})
        return _freshness_payload(payload)
    except Exception as error:
        # Freshness is supplementary.  A missing status RPC must not hide a
        # valid official metric response; it is still logged for operations.
        log_event(logging.WARNING, "ai_agent_freshness_unavailable", error_type=type(error).__name__)
        return None, {"status": "não informado"}


async def _call_first(
    adapter: RuntimeRpcAdapter,
    names: tuple[str, ...],
    values: dict[str, tuple[Any, str]],
    *,
    required: tuple[str, ...],
) -> tuple[str, Any]:
    last_error: RuntimeFunctionUnavailable | None = None
    for name in names:
        try:
            return name, decode_payload(await adapter.call(name, values, required_arguments=required))
        except RuntimeFunctionUnavailable as error:
            log_event(logging.DEBUG, "ai_agent_rpc_candidate_unavailable", function=name, error_type=type(error).__name__)
            last_error = error
    raise ToolUnavailable(str(last_error or "Fonte oficial indisponível"))


def _sales_data(raw: Any, blocks: list[str]) -> tuple[dict[str, Any], list[Any], list[Any]]:
    payload = decode_payload(raw)
    if not isinstance(payload, dict):
        return {"status": "empty", "kpis": {}}, [], []
    kpis = decode_payload(payload.get("kpis", {}))
    data: dict[str, Any] = {"status": "computed", "kpis": compact_result(kpis)}
    series = list_value(payload, "serieMensal", "serie_mensal")
    if "serie" in blocks or "resumo" in blocks:
        data["series"] = compact_result(series)
    rankings: dict[str, Any] = {}
    if "rankings" in blocks or "resumo" in blocks:
        for label, keys in {
            "vendedores": ("rankingVendedores", "ranking_vendedores"),
            "cidades": ("rankingCidades", "ranking_cidades"),
            "produtos": ("rankingProdutos", "ranking_produtos"),
            "origens": ("origensLead", "origens_lead"),
            "bancos": ("financiamentoBancos", "financiamento_bancos"),
            "tipos_cliente": ("tiposCliente", "tipos_cliente"),
        }.items():
            rows = list_value(payload, *keys)
            if rows:
                rankings[label] = compact_result(rows)
    if rankings:
        data["rankings"] = rankings
    if "perdas" in blocks or "resumo" in blocks:
        losses = payload.get("perdas", {})
        loss_data: dict[str, Any] = {"kpis": {key: kpis.get(key) for key in ("valorPerdido", "totalPerdido") if isinstance(kpis, dict) and key in kpis}}
        if isinstance(losses, dict):
            for label, keys in {"vendedores": ("rankingVendedores",), "cidades": ("rankingCidades",), "produtos": ("rankingProdutos",), "motivos": ("motivosPerda",), "origens": ("origensLead",)}.items():
                rows = list_value(losses, *keys) or list_value(payload, *keys)
                if rows:
                    loss_data[label] = compact_result(rows)
        data["perdas"] = loss_data
    if "produtos" in blocks and "rankings" not in blocks:
        data["produtos"] = compact_result(list_value(payload, "rankingProdutos", "ranking_produtos"))
    return data, series, list(data.get("rankings", {}).get("vendedores", [])) if isinstance(data.get("rankings"), dict) else []


async def execute_sales(context: ToolContext, input_data: SalesToolInput, call_id: str) -> Any:
    started = time.monotonic()
    funis, mode_warnings = funnel_scope(input_data.modo_funil, input_data.funis_selecionados)
    filters = input_data.filtros
    values = _rpc_values(input_data.periodo_inicio.isoformat(), input_data.periodo_fim.isoformat(), filters, funis=funis)
    required = ("p_from", "p_to") if input_data.modo_funil == "padrao" else ("p_from", "p_to", "p_funis")
    adapter = RuntimeRpcAdapter(context.analytical_query)
    try:
        rpc_name, raw = await _call_first(adapter, (SALES_RPC,), values, required=required)
    except ToolUnavailable as error:
        log_event(logging.WARNING, "ai_agent_sales_source_unavailable", error_type=type(error).__name__)
        raise ToolUnavailable("A fonte oficial de desempenho de vendas não está disponível neste alvo.") from error
    data, series, ranking_rows = _sales_data(raw, input_data.blocos)
    mode_label = {
        "padrao": "Venda padrão: pedido aprovado ligado a negócio ganho; Repasse de Máquina excluído.",
        "todos": "Venda com todos os funis selecionados, incluindo Repasse de Máquina.",
        "somente_repasse": "Somente vendas do funil Repasse de Máquina.",
        "selecionados": "Somente os funis selecionados pelo usuário.",
    }[input_data.modo_funil]
    data["concept"] = mode_label
    data["competencias"] = {
        "vendas_faturamento_ticket": "aprovação do pedido",
        "perdas_valor_perdido": "fechamento do negócio",
    }
    data["funnel_mode"] = input_data.modo_funil
    data = compact_result(data)
    refreshed_at, freshness = await _freshness(context)
    source_id = f"vendas:{context.conversation_id}:{call_id}"
    row_count = len(ranking_rows) + len(series)
    source = source_for(
        source_id=source_id,
        label="Desempenho de vendas",
        intent="agent_tool",
        metric_definitions=_metric_defs(_metric_ids_for_sales(input_data.blocos)),
        period={"from": input_data.periodo_inicio.isoformat(), "to": input_data.periodo_fim.isoformat()},
        filters=filters_payload(filters),
        requested_filters={**filters_payload(filters), "modo_funil": input_data.modo_funil, "funis_selecionados": input_data.funis_selecionados},
        warnings=[*mode_warnings],
        refreshed_at=refreshed_at,
        elapsed_ms=now_elapsed(started),
        row_count=row_count,
        competence=["aprovação do pedido", "fechamento do negócio"],
        lineage_executor=rpc_name,
        freshness=freshness,
        funnel_mode=input_data.modo_funil,
    )
    artifacts = build_sales_artifacts(data, input_data.blocos, input_data.apresentacao, source_id)
    return ToolExecutionResult(data=data, source=source, artifacts=artifacts, warnings=mode_warnings)


class ToolExecutionResult:
    """Tiny structural return type kept independent from the registry."""

    def __init__(self, *, data: dict[str, Any], source: Any, artifacts: list[Any] | None = None, warnings: list[str] | None = None):
        self.data = data
        self.source = source
        self.artifacts = artifacts or []
        self.warnings = warnings or []


async def execute_actions(context: ToolContext, input_data: ActionsToolInput, call_id: str) -> ToolExecutionResult:
    started = time.monotonic()
    funis, mode_warnings = funnel_scope(input_data.modo_funil, input_data.funis_selecionados)
    filters = input_data.filtros
    values = _rpc_values(input_data.periodo_inicio.isoformat(), input_data.periodo_fim.isoformat(), filters, funis=funis, tipo_acao=input_data.tipo_acao)
    adapter = RuntimeRpcAdapter(context.analytical_query)
    try:
        scope_required = ("p_from", "p_to") if input_data.modo_funil == "padrao" else ("p_from", "p_to", "p_funis")
        summary_rpc, summary_raw = await _call_first(adapter, ACTION_SUMMARY_RPCS, values, required=scope_required)
    except ToolUnavailable as error:
        log_event(logging.WARNING, "ai_agent_actions_source_unavailable", error_type=type(error).__name__)
        raise ToolUnavailable("A fonte oficial de ações não está disponível neste alvo.") from error
    payload = decode_payload(summary_raw) if isinstance(summary_raw, (dict, list, str)) else {}
    data: dict[str, Any] = {
        "competencias": {
            "acoes_visitas": "conclusão da ação",
            "ganhos": "aprovação do pedido",
            "perdas": "fechamento do negócio",
        },
        "funnel_mode": input_data.modo_funil,
        "funnel_applies_to": ["ganhos", "perdas"],
        "resumo": compact_result(payload),
    }
    if "evolucao" in input_data.blocos:
        try:
            _, visit_series = await _call_first(adapter, (ACTION_VISIT_SERIES_RPC,), values, required=("p_from", "p_to"))
            data["evolucao"] = compact_result(visit_series)
        except ToolUnavailable as error:
            log_event(logging.DEBUG, "ai_agent_action_visit_series_unavailable", error_type=type(error).__name__)
            data["evolucao"] = list_value(payload, "porMes", "por_mes")
            mode_warnings.append("A série específica de visitas não está disponível; usei a série do resumo.")
    if any(block in input_data.blocos for block in ("funil", "ranking", "resumo")):
        try:
            funnel_rpc, funnel_raw = await _call_first(adapter, ACTION_FUNNEL_RPCS, values, required=scope_required)
            data["funil"] = compact_result(funnel_raw)
        except ToolUnavailable as error:
            log_event(logging.DEBUG, "ai_agent_action_funnel_unavailable", error_type=type(error).__name__)
            funnel_rpc = None
            mode_warnings.append("O bloco de funil não está disponível na fonte instalada.")
    else:
        funnel_rpc = None
    details_rpc = None
    if "detalhes" in input_data.blocos:
        try:
            details_rpc, details_raw = await _call_first(adapter, (ACTION_DETAIL_RPC,), values, required=scope_required)
            data["detalhes"] = compact_result(details_raw)
        except ToolUnavailable as error:
            log_event(logging.DEBUG, "ai_agent_action_detail_unavailable", error_type=type(error).__name__)
            mode_warnings.append("O detalhamento de ações não está disponível na fonte instalada.")
    if "ganhos" in input_data.blocos:
        required = ("p_from", "p_to") if input_data.modo_funil == "padrao" else ("p_from", "p_to", "p_funis")
        try:
            _, gained = await _call_first(adapter, ("rpc_acoes_pedidos_ganhos",), values, required=required)
            data["ganhos"] = compact_result(gained)
        except ToolUnavailable as error:
            log_event(logging.DEBUG, "ai_agent_action_gains_unavailable", error_type=type(error).__name__)
            mode_warnings.append("O detalhamento de ganhos não está disponível na fonte instalada.")
    if "perdas" in input_data.blocos:
        required = ("p_from", "p_to") if input_data.modo_funil == "padrao" else ("p_from", "p_to", "p_funis")
        try:
            _, lost = await _call_first(adapter, ("rpc_acoes_negocios_perdidos",), values, required=required)
            data["perdas"] = compact_result(lost)
        except ToolUnavailable as error:
            log_event(logging.DEBUG, "ai_agent_action_losses_unavailable", error_type=type(error).__name__)
            mode_warnings.append("O detalhamento de perdas não está disponível na fonte instalada.")
    data["warnings"] = list(dict.fromkeys(mode_warnings))
    data = compact_result(data)
    refreshed_at, freshness = await _freshness(context)
    source_id = f"acoes:{context.conversation_id}:{call_id}"
    source = source_for(
        source_id=source_id,
        label="Ações comerciais",
        intent="agent_tool",
        metric_definitions=_metric_defs(["acoes.visitas", "acoes.oportunidades", "acoes.ganhos", "acoes.perdidos"]),
        period={"from": input_data.periodo_inicio.isoformat(), "to": input_data.periodo_fim.isoformat()},
        filters=filters_payload(filters),
        requested_filters={**filters_payload(filters), "tipo_acao": input_data.tipo_acao, "modo_funil": input_data.modo_funil},
        warnings=mode_warnings,
        refreshed_at=refreshed_at,
        elapsed_ms=now_elapsed(started),
        row_count=count_nested_rows(data),
        competence=["conclusão da ação", "aprovação do pedido", "fechamento do negócio"],
        lineage_executor="+".join(name for name in (summary_rpc, funnel_rpc, details_rpc) if name),
        freshness=freshness,
        funnel_mode=input_data.modo_funil,
    )
    artifacts: list[Any] = []
    if input_data.apresentacao == "linha":
        rows = data.get("evolucao", []) if isinstance(data, dict) else []
        if isinstance(rows, list):
            artifact = chart_artifact("line", "Evolução de visitas", rows, source_id, "name")
            if artifact:
                artifacts.append(artifact)
    if input_data.apresentacao == "tabela" and isinstance(data.get("ganhos"), dict):
        artifact = table_artifact("Ganhos relacionados a ações", list_value(data["ganhos"], "rows"), source_id)
        if artifact:
            artifacts.append(artifact)
    if input_data.apresentacao == "tabela" and isinstance(data.get("detalhes"), dict):
        detail_rows = list_value(data["detalhes"], "rows", "tabelaAcoes", "tabela_acoes")
        artifact = table_artifact("Ações do período", detail_rows, source_id)
        if artifact:
            artifacts.append(artifact)
    return ToolExecutionResult(data=data, source=source, artifacts=artifacts, warnings=mode_warnings)


async def execute_team(context: ToolContext, input_data: TeamToolInput, call_id: str) -> ToolExecutionResult:
    started = time.monotonic()
    filters = ToolFilters(vendedor=input_data.consultor, cidade=input_data.cidade)
    values = _rpc_values(f"{input_data.ano}-01-01", f"{input_data.ano}-12-31", filters)
    values["p_ano"] = (input_data.ano, "integer")
    adapter = RuntimeRpcAdapter(context.analytical_query)
    try:
        rpc_name, raw = await _call_first(adapter, (TEAM_RPC,), values, required=("p_ano",))
    except ToolUnavailable as error:
        log_event(logging.WARNING, "ai_agent_team_source_unavailable", error_type=type(error).__name__)
        raise ToolUnavailable("A fonte oficial de desempenho da equipe não está disponível neste alvo.") from error
    payload = decode_payload(raw)
    if not isinstance(payload, dict):
        payload = {"rows": [], "team": []}
    rows = team_rows(payload.get("rows"), input_data.meses)
    team = team_rows(payload.get("team"), input_data.meses)
    selected = set(input_data.indicadores)
    data: dict[str, Any] = {
        "status": "computed",
        "ano": input_data.ano,
        "meses": input_data.meses,
        "rows": rows,
        "team": team,
        "indicadores": list(input_data.indicadores),
        "total": team_totals(team),
        "concept": "Agregados por consultor e mês conforme a fonte oficial da equipe.",
    }
    if "vendas" not in selected:
        for item in data["rows"]:
            drop_unselected(item, selected)
        for item in data["team"]:
            drop_unselected(item, selected)
    data = compact_result(data)
    refreshed_at, freshness = await _freshness(context)
    source_id = f"equipe:{context.conversation_id}:{call_id}"
    metric_ids = [f"equipe.{indicator}" for indicator in input_data.indicadores if get_agent_metric(f"equipe.{indicator}")]
    source = source_for(
        source_id=source_id,
        label="Desempenho da equipe",
        intent="agent_tool",
        metric_definitions=_metric_defs(metric_ids or ["equipe.vendas"]),
        period={"from": f"{input_data.ano}-01-01", "to": f"{input_data.ano}-12-31"},
        filters={key: value for key, value in {"consultor": input_data.consultor, "cidade": input_data.cidade, "meses": input_data.meses}.items() if value not in (None, "", [])},
        requested_filters={"ano": input_data.ano, "meses": input_data.meses, "consultor": input_data.consultor, "cidade": input_data.cidade},
        warnings=[],
        refreshed_at=refreshed_at,
        elapsed_ms=now_elapsed(started),
        row_count=len(rows) + len(team),
        competence=["competência mensal da equipe"],
        lineage_executor=rpc_name,
        freshness=freshness,
    )
    artifacts: list[Any] = []
    if input_data.apresentacao == "tabela":
        artifact = table_artifact("Desempenho por consultor e mês", rows or team, source_id)
        if artifact:
            artifacts.append(artifact)
    return ToolExecutionResult(data=data, source=source, artifacts=artifacts)
