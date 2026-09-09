"""Deterministic comparisons and associations over official tool outputs."""

from __future__ import annotations

from datetime import date
from typing import Any

from ya_agent_catalog import get_agent_metric, metric_payload
from ya_agent_models import (
    CompareToolInput,
    CorrelationToolInput,
    SalesToolInput,
    ActionsToolInput,
    TeamToolInput,
    ToolFilters,
)
from ya_agent_tools.common import (
    ToolContext,
    ToolInputError,
    chart_artifact,
    compact_result,
    filters_payload,
    now_elapsed,
    source_for,
    table_artifact,
)
from ya_agent_tools.official import execute_actions, execute_sales, execute_team
from ya_tool_utils import _number, pearson


def _period_days(start: date, end: date) -> int:
    return (end - start).days + 1


def _metric_value(data: Any, metric_id: str) -> float | None:
    if not isinstance(data, dict):
        return None
    metric = get_agent_metric(metric_id)
    short = metric_id.rsplit(".", 1)[-1]
    aliases = {
        "faturamento": ("faturamento", "valorGanho", "valor_ganho"),
        "pedidos_aprovados": ("totalPedidos", "quantidade_vendas", "vendas", "ganhos"),
        "ticket_medio": ("ticketMedio", "ticket_medio"),
        "valor_perdido": ("valorPerdido", "valor_perdido"),
        "negocios_perdidos": ("totalPerdido", "negocios_perdidos", "perdidos"),
        "visitas": ("visitas",),
        "oportunidades": ("oportunidades", "negocios"),
        "ganhos": ("ganhos", "quantidade_vendas"),
        "perdidos": ("perdidos",),
        "pipeline_aberto": ("pipelineAberto", "valorPipelineAberto", "pipeline_aberto"),
        "meta": ("meta",),
        "conversao": ("taxaConversao", "taxa_conversao_negocios", "conversao"),
    }
    keys = aliases.get(short, (short,))
    containers = [data]
    for key in ("kpis", "resumo", "total"):
        if isinstance(data.get(key), dict):
            containers.append(data[key])
    for container in containers:
        for key in keys:
            number = _number(container.get(key))
            if number is not None:
                return number
    return None


def _percentage_change(current: float | None, baseline: float | None) -> dict[str, Any]:
    if current is None or baseline is None:
        return {"absolute": None, "percentage": None, "baseline_zero": False, "status": "sem_dado"}
    absolute = round(current - baseline, 4)
    if baseline == 0:
        return {"absolute": absolute, "percentage": None, "baseline_zero": True, "status": "base_zero"}
    return {"absolute": absolute, "percentage": round(absolute * 100 / baseline, 4), "baseline_zero": False, "status": "computed"}


async def execute_compare(context: ToolContext, input_data: CompareToolInput, call_id: str):
    started = __import__("time").monotonic()
    if input_data.dominio == "vendas":
        current = await execute_sales(context, SalesToolInput(
            periodo_inicio=input_data.periodo_atual_inicio,
            periodo_fim=input_data.periodo_atual_fim,
            filtros=input_data.filtros,
            modo_funil=input_data.modo_funil,
            funis_selecionados=input_data.funis_selecionados,
            blocos=["kpis"],
            apresentacao="kpi_group",
        ), f"{call_id}-atual")
        baseline = await execute_sales(context, SalesToolInput(
            periodo_inicio=input_data.periodo_base_inicio,
            periodo_fim=input_data.periodo_base_fim,
            filtros=input_data.filtros,
            modo_funil=input_data.modo_funil,
            funis_selecionados=input_data.funis_selecionados,
            blocos=["kpis"],
            apresentacao="kpi_group",
        ), f"{call_id}-base")
        baseline_full = None
        import calendar
        _, last_day_prev = calendar.monthrange(input_data.periodo_base_inicio.year, input_data.periodo_base_inicio.month)
        full_month_end = input_data.periodo_base_inicio.replace(day=last_day_prev)
        if full_month_end > input_data.periodo_base_fim:
            baseline_full = await execute_sales(context, SalesToolInput(
                periodo_inicio=input_data.periodo_base_inicio.replace(day=1),
                periodo_fim=full_month_end,
                filtros=input_data.filtros,
                modo_funil=input_data.modo_funil,
                funis_selecionados=input_data.funis_selecionados,
                blocos=["kpis"],
                apresentacao="kpi_group",
            ), f"{call_id}-base-full")
    elif input_data.dominio == "acoes":
        current = await execute_actions(context, ActionsToolInput(
            periodo_inicio=input_data.periodo_atual_inicio,
            periodo_fim=input_data.periodo_atual_fim,
            filtros=input_data.filtros,
            modo_funil=input_data.modo_funil,
            funis_selecionados=input_data.funis_selecionados,
            blocos=["resumo"],
            apresentacao="kpi_group",
        ), f"{call_id}-atual")
        baseline = await execute_actions(context, ActionsToolInput(
            periodo_inicio=input_data.periodo_base_inicio,
            periodo_fim=input_data.periodo_base_fim,
            filtros=input_data.filtros,
            modo_funil=input_data.modo_funil,
            funis_selecionados=input_data.funis_selecionados,
            blocos=["resumo"],
            apresentacao="kpi_group",
        ), f"{call_id}-base")
    else:
        current_years = {input_data.periodo_atual_inicio.year, input_data.periodo_atual_fim.year}
        baseline_years = {input_data.periodo_base_inicio.year, input_data.periodo_base_fim.year}
        if len(current_years) != 1 or len(baseline_years) != 1:
            raise ToolInputError("A comparação da equipe precisa ocorrer dentro de anos definidos.")
        current = await execute_team(context, TeamToolInput(
            ano=input_data.periodo_atual_inicio.year,
            meses=_months_in_period(input_data.periodo_atual_inicio, input_data.periodo_atual_fim),
            consultor=input_data.filtros.vendedor,
            cidade=input_data.filtros.cidade,
            indicadores=[_team_indicator(item) for item in input_data.metricas],
            apresentacao="tabela",
        ), f"{call_id}-atual")
        baseline = await execute_team(context, TeamToolInput(
            ano=input_data.periodo_base_inicio.year,
            meses=_months_in_period(input_data.periodo_base_inicio, input_data.periodo_base_fim),
            consultor=input_data.filtros.vendedor,
            cidade=input_data.filtros.cidade,
            indicadores=[_team_indicator(item) for item in input_data.metricas],
            apresentacao="tabela",
        ), f"{call_id}-base")
    comparisons = []
    for metric_id in input_data.metricas:
        current_value = _metric_value(current.data, metric_id)
        baseline_value = _metric_value(baseline.data, metric_id)
        comparisons.append({
            "metrica": metric_id,
            "atual": current_value,
            "base": baseline_value,
            "variacao": _percentage_change(current_value, baseline_value),
        })
    current_days = _period_days(input_data.periodo_atual_inicio, input_data.periodo_atual_fim)
    baseline_days = _period_days(input_data.periodo_base_inicio, input_data.periodo_base_fim)
    month_full_info = None
    if "baseline_full" in locals() and baseline_full:
        month_full_info = {
            "inicio": input_data.periodo_base_inicio.replace(day=1).isoformat(),
            "fim": full_month_end.isoformat(),
            "dias": last_day_prev,
            "metricas": {m: _metric_value(baseline_full.data, m) for m in input_data.metricas},
        }
    MONTH_NAMES_PT = {
        1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril",
        5: "Maio", 6: "Junho", 7: "Julho", 8: "Agosto",
        9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro",
    }
    cur_m = MONTH_NAMES_PT.get(input_data.periodo_atual_inicio.month, "")
    base_m = MONTH_NAMES_PT.get(input_data.periodo_base_inicio.month, "")
    cur_name = f"{cur_m}/{input_data.periodo_atual_inicio.year}"
    base_name = f"{base_m}/{input_data.periodo_base_inicio.year}"

    for comp in comparisons:
        m_id = comp.get("metrica", "")
        comp["indicador"] = {
            "vendas.faturamento": "Faturamento Aprovado",
            "vendas.pedidos_aprovados": "Pedidos Aprovados",
            "vendas.ticket_medio": "Ticket Médio",
            "vendas.valor_perdido": "Valor Perdido",
            "vendas.negocios_perdidos": "Negócios Perdidos",
        }.get(m_id, m_id)
        comp["mes_atual"] = cur_name
        comp["mes_anterior"] = base_name

    data = compact_result({
        "status": "computed",
        "dominio": input_data.dominio,
        "mes_atual_nome": cur_name,
        "mes_anterior_nome": base_name,
        "periodo_atual_descricao": f"01 a {input_data.periodo_atual_fim.day:02d} de {cur_m} ({cur_name} em andamento)",
        "periodo_base_descricao": f"01 a {input_data.periodo_base_fim.day:02d} de {base_m} ({base_name} proporcional)",
        "comparacoes": comparisons,
        "periodo_atual": {"inicio": input_data.periodo_atual_inicio.isoformat(), "fim": input_data.periodo_atual_fim.isoformat(), "dias": current_days, "mes": cur_name},
        "periodo_base": {"inicio": input_data.periodo_base_inicio.isoformat(), "fim": input_data.periodo_base_fim.isoformat(), "dias": baseline_days, "mes": base_name},
        "duracoes_diferentes": current_days != baseline_days,
        "mes_anterior_fechado": month_full_info,
        "aviso_ao_modelo": f"ATENÇÃO: {cur_name} é o mês ATUAL. {base_name} é o mês ANTERIOR. Nunca inverta os meses nem os valores na resposta.",
        "conceito": "Os dois períodos usam os mesmos filtros e o mesmo contrato oficial.",
    })
    source_id = f"comparacao:{context.conversation_id}:{call_id}"
    warnings = ["As janelas têm durações diferentes; a comparação deve ser interpretada com essa cobertura."] if current_days != baseline_days else []
    if month_full_info:
        import json as _json
        warnings.append(f"Mês anterior fechado completo ({month_full_info['inicio']} a {month_full_info['fim']}): {_json.dumps(month_full_info['metricas'])}")
    source = source_for(
        source_id=source_id,
        label="Comparação de períodos",
        intent="agent_tool",
        metric_definitions=[metric_payload(item) for item in input_data.metricas if metric_payload(item)],
        period=None,
        filters={**filters_payload(input_data.filtros), "modo_funil": input_data.modo_funil},
        requested_filters={
            "dominio": input_data.dominio,
            "metricas": input_data.metricas,
            "filtros": filters_payload(input_data.filtros),
            "modo_funil": input_data.modo_funil,
            "funis_selecionados": input_data.funis_selecionados,
        },
        warnings=warnings,
        elapsed_ms=round((__import__("time").monotonic() - started) * 1000),
        row_count=len(comparisons),
        competence=["aprovação do pedido", "fechamento do negócio"] if input_data.dominio == "vendas" else None,
        lineage_executor="compare_periods",
        comparison={
            "atual": {"from": input_data.periodo_atual_inicio.isoformat(), "to": input_data.periodo_atual_fim.isoformat()},
            "base": {"from": input_data.periodo_base_inicio.isoformat(), "to": input_data.periodo_base_fim.isoformat()},
        },
    )
    METRIC_HUMAN_LABELS = {
        "vendas.faturamento": "Faturamento",
        "vendas.pedidos_aprovados": "Pedidos Aprovados",
        "vendas.ticket_medio": "Ticket Médio",
        "vendas.valor_perdido": "Valor Perdido",
        "vendas.negocios_perdidos": "Negócios Perdidos",
    }
    rows = [{"Métrica": METRIC_HUMAN_LABELS.get(item["metrica"], item["metrica"]), "Atual": item["atual"], "Base": item["base"], "Variação (%)": item["variacao"]["percentage"]} for item in comparisons]
    artifact = table_artifact("Comparação entre períodos", rows, source_id) if input_data.apresentacao != "texto" else None
    artifacts = [artifact] if artifact else []
    return _Result(data, source, artifacts, source.warnings)


async def execute_correlation(context: ToolContext, input_data: CorrelationToolInput, call_id: str):
    started = __import__("time").monotonic()
    first_metric = get_agent_metric(input_data.metrica_a)
    second_metric = get_agent_metric(input_data.metrica_b)
    if not first_metric or not second_metric:
        return _blocked_correlation(context, input_data, call_id, "As medidas precisam pertencer à mesma área e compartilhar uma coorte.")
    domains = {first_metric.domain, second_metric.domain}
    if domains == {"vendas"} and input_data.granularidade in {"consultor", "cidade", "mes"}:
        block = "serie" if input_data.granularidade == "mes" else "rankings"
        result_a = await execute_sales(context, SalesToolInput(periodo_inicio=input_data.periodo_inicio, periodo_fim=input_data.periodo_fim, filtros=input_data.filtros, blocos=[block], apresentacao="tabela"), f"{call_id}-a")
        rows_a = _sales_series(result_a.data) if input_data.granularidade == "mes" else _sales_rankings(result_a.data, "cidades" if input_data.granularidade == "cidade" else "vendedores")
        pairs = _pair_rows(rows_a, input_data.metrica_a, input_data.metrica_b)
    elif domains == {"acoes"} and input_data.granularidade in {"consultor", "cidade", "mes"}:
        blocks = ["evolucao"] if input_data.granularidade == "mes" else ["ranking", "funil"]
        result_a = await execute_actions(context, ActionsToolInput(periodo_inicio=input_data.periodo_inicio, periodo_fim=input_data.periodo_fim, filtros=input_data.filtros, blocos=blocks, apresentacao="tabela"), f"{call_id}-a")
        rows_a = _actions_series(result_a.data) if input_data.granularidade == "mes" else _actions_rankings(result_a.data, input_data.granularidade)
        pairs = _pair_rows(rows_a, input_data.metrica_a, input_data.metrica_b)
    elif domains == {"acoes", "vendas"} and input_data.granularidade in {"consultor", "cidade", "mes"}:
        action_blocks = ["evolucao"] if input_data.granularidade == "mes" else ["ranking", "funil"]
        action_result = await execute_actions(context, ActionsToolInput(periodo_inicio=input_data.periodo_inicio, periodo_fim=input_data.periodo_fim, filtros=input_data.filtros, blocos=action_blocks, apresentacao="tabela"), f"{call_id}-acoes")
        sales_block = "serie" if input_data.granularidade == "mes" else "rankings"
        sales_result = await execute_sales(context, SalesToolInput(periodo_inicio=input_data.periodo_inicio, periodo_fim=input_data.periodo_fim, filtros=input_data.filtros, blocos=[sales_block], apresentacao="tabela"), f"{call_id}-vendas")
        action_rows = _actions_series(action_result.data) if input_data.granularidade == "mes" else _actions_rankings(action_result.data, input_data.granularidade)
        sales_rows = _sales_series(sales_result.data) if input_data.granularidade == "mes" else _sales_rankings(sales_result.data, "cidades" if input_data.granularidade == "cidade" else "vendedores")
        first_rows, second_rows = (action_rows, sales_rows) if first_metric.domain == "acoes" else (sales_rows, action_rows)
        pairs = _pair_row_sets(first_rows, second_rows, input_data.metrica_a, input_data.metrica_b)
    elif domains == {"equipe"} and input_data.granularidade in {"consultor", "mes"}:
        if input_data.periodo_inicio.year != input_data.periodo_fim.year:
            return _blocked_correlation(context, input_data, call_id, "A associação da equipe precisa ocorrer dentro de um único ano.")
        indicators = [_team_indicator(input_data.metrica_a), _team_indicator(input_data.metrica_b)]
        result_a = await execute_team(context, TeamToolInput(ano=input_data.periodo_inicio.year, meses=_months_in_period(input_data.periodo_inicio, input_data.periodo_fim), consultor=input_data.filtros.vendedor, cidade=input_data.filtros.cidade, indicadores=list(dict.fromkeys(indicators)), apresentacao="tabela"), f"{call_id}-a")
        rows_a = result_a.data.get("rows", []) if isinstance(result_a.data, dict) else []
        pairs = _pair_rows(rows_a, input_data.metrica_a, input_data.metrica_b)
    else:
        return _blocked_correlation(context, input_data, call_id, "Esta granularidade ainda não tem um corte oficial pareável.")
    coefficient = pearson(pairs) if len(pairs) >= 3 else None
    status = "computed" if coefficient is not None else "insufficient_sample"
    warnings = [] if coefficient is not None else ["A amostra pareada precisa de pelo menos três pontos não nulos e variáveis não constantes."]
    data = compact_result({
        "status": status,
        "metrica_a": input_data.metrica_a,
        "metrica_b": input_data.metrica_b,
        "granularidade": input_data.granularidade,
        "metodo": "Pearson",
        "n": len(pairs),
        "coeficiente": coefficient,
        "associacao_observada": _direction(coefficient),
        "causalidade": False,
        "pares": [{"x": x, "y": y} for x, y in pairs[:100]],
    })
    source_id = f"correlacao:{context.conversation_id}:{call_id}"
    source = source_for(
        source_id=source_id,
        label="Associação entre métricas",
        intent="agent_tool",
        metric_definitions=[metric_payload(item) for item in (input_data.metrica_a, input_data.metrica_b) if metric_payload(item)],
        period={"from": input_data.periodo_inicio.isoformat(), "to": input_data.periodo_fim.isoformat()},
        filters=filters_payload(input_data.filtros),
        requested_filters={"granularidade": input_data.granularidade},
        warnings=warnings,
        elapsed_ms=round((__import__("time").monotonic() - started) * 1000),
        row_count=len(pairs),
        competence=["competência do contrato da área"],
        lineage_executor="pearson_backend",
    )
    artifact = chart_artifact("bar", "Pontos pareados da associação", [{"name": str(index + 1), "metrica_a": x, "metrica_b": y} for index, (x, y) in enumerate(pairs)], source_id, "name")
    return _Result(data, source, [artifact] if artifact else [], warnings)


def _blocked_correlation(context: ToolContext, input_data: CorrelationToolInput, call_id: str, warning: str):
    source_id = f"correlacao:{context.conversation_id}:{call_id}"
    source = source_for(source_id=source_id, label="Associação entre métricas", intent="agent_tool", metric_definitions=[], period={"from": input_data.periodo_inicio.isoformat(), "to": input_data.periodo_fim.isoformat()}, filters=filters_payload(input_data.filtros), warnings=[warning], row_count=0, lineage_executor="pearson_backend")
    return _Result({"status": "blocked", "n": 0, "causalidade": False, "motivo": warning}, source, [], [warning])


def _sales_rankings(data: Any, key: str) -> list[dict[str, Any]]:
    if not isinstance(data, dict) or not isinstance(data.get("rankings"), dict):
        return []
    value = data["rankings"].get(key)
    return value if isinstance(value, list) else []


def _sales_series(data: Any) -> list[dict[str, Any]]:
    if not isinstance(data, dict):
        return []
    value = data.get("series")
    return value if isinstance(value, list) else []


def _actions_series(data: Any) -> list[dict[str, Any]]:
    if not isinstance(data, dict):
        return []
    value = data.get("evolucao")
    return value if isinstance(value, list) else []


def _actions_rankings(data: Any, granularity: str = "consultor") -> list[dict[str, Any]]:
    if not isinstance(data, dict):
        return []
    funnel = data.get("funil")
    if isinstance(funnel, dict):
        for key in ("rankingConsultores", "ranking_consultores"):
            if granularity == "consultor" and isinstance(funnel.get(key), list):
                return funnel[key]
    summary = data.get("resumo")
    if isinstance(summary, dict):
        keys = ("porCidade", "por_cidade") if granularity == "cidade" else ("porVendedor", "por_vendedor")
        for key in keys:
            if isinstance(summary.get(key), list):
                return summary[key]
    return []


def _pair_rows(rows: list[dict[str, Any]], metric_a: str, metric_b: str) -> list[tuple[float, float]]:
    pairs: list[tuple[float, float]] = []
    for row in rows:
        x = _row_metric(row, metric_a)
        y = _row_metric(row, metric_b)
        if x is not None and y is not None:
            pairs.append((x, y))
    return pairs


def _pair_row_sets(first: list[dict[str, Any]], second: list[dict[str, Any]], metric_a: str, metric_b: str) -> list[tuple[float, float]]:
    index = {_label(row): row for row in second if isinstance(row, dict)}
    pairs: list[tuple[float, float]] = []
    for row in first:
        if not isinstance(row, dict):
            continue
        other = index.get(_label(row))
        if not other:
            continue
        x = _row_metric(row, metric_a)
        y = _row_metric(other, metric_b)
        if x is not None and y is not None:
            pairs.append((x, y))
    return pairs


def _label(row: dict[str, Any]) -> str:
    for key in ("name", "nome", "consultor", "vendedor", "label"):
        if row.get(key) not in (None, ""):
            return str(row[key]).casefold().strip()
    return ""


def _row_metric(row: dict[str, Any], metric_id: str) -> float | None:
    short = metric_id.rsplit(".", 1)[-1]
    aliases = {
        "faturamento": ("faturamento", "valor", "valorVendido", "valor_vendido"),
        "pedidos_aprovados": ("qtd", "quantidade_vendas", "vendas", "ganhos"),
        "valor_perdido": ("valor", "valorPerdido"),
        "negocios_perdidos": ("qtd", "perdidos"),
        "visitas": ("visitas", "acoes"),
        "oportunidades": ("oportunidades", "negocios"),
        "ganhos": ("ganhos", "quantidade_vendas"),
        "perdidos": ("perdidos",),
        "vendas": ("quantidade_vendas", "vendas", "qtd_vendas"),
        "ticket_medio": ("ticket_medio", "ticketMedio"),
        "meta": ("meta",),
        "conversao": ("taxa_conversao_negocios", "taxaConversaoNegocios"),
    }
    for key in aliases.get(short, (short,)):
        number = _number(row.get(key))
        if number is not None:
            return number
    return None


def _direction(coefficient: float | None) -> str:
    if coefficient is None:
        return "não calculada"
    if coefficient >= 0.7:
        return "positiva forte"
    if coefficient >= 0.3:
        return "positiva moderada"
    if coefficient <= -0.7:
        return "negativa forte"
    if coefficient <= -0.3:
        return "negativa moderada"
    return "fraca ou próxima de zero"


def _months_in_period(start: date, end: date) -> list[int]:
    if start.year != end.year:
        return list(range(1, 13))
    return list(range(start.month, end.month + 1))


def _team_indicator(metric_id: str) -> str:
    short = metric_id.rsplit(".", 1)[-1]
    return short if short in {"vendas", "faturamento", "ticket_medio", "meta", "conversao", "negocios", "oportunidades_abertas"} else "vendas"


class _Result:
    def __init__(self, data: dict[str, Any], source: Any, artifacts: list[Any], warnings: list[str]):
        self.data = data
        self.source = source
        self.artifacts = artifacts
        self.warnings = warnings
