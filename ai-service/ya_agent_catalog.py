"""Small catalog view exposed to the v2 agent prompt and explain tool."""

from __future__ import annotations

from typing import Any

from ya_catalog import CATALOG_VERSION, METRICS, MetricDefinition


TEAM_METRICS: dict[str, MetricDefinition] = {
    "equipe.vendas": MetricDefinition(
        id="equipe.vendas", label="Vendas da equipe", domain="equipe",
        description="Quantidade de vendas mensais conforme a RPC vigente da equipe.",
        unit="count", entity="consultor-mês", grain="consultor-mês",
        competence="competência mensal do contrato da equipe",
        deduplication="deduplicação aplicada pela RPC instalada",
        executor="team_performance", value_path=("quantidade_vendas",),
        dimensions=("consultor", "cidade"), filters=("vendedor", "cidade"),
        aliases=("vendas da equipe", "vendas por consultor", "quantidade de vendas"),
        formula="vendas mensais do contrato da equipe", exclusions="conforme RPC vigente",
    ),
    "equipe.faturamento": MetricDefinition(
        id="equipe.faturamento", label="Faturamento da equipe", domain="equipe",
        description="Faturamento mensal conforme o contrato vigente da equipe.",
        unit="BRL", entity="consultor-mês", grain="consultor-mês",
        competence="competência mensal do contrato da equipe",
        deduplication="deduplicação aplicada pela RPC instalada",
        executor="team_performance", value_path=("faturamento",),
        dimensions=("consultor", "cidade"), filters=("vendedor", "cidade"),
        aliases=("faturamento da equipe", "receita da equipe"),
        formula="faturamento mensal do contrato da equipe", exclusions="conforme RPC vigente",
    ),
    "equipe.ticket_medio": MetricDefinition(
        id="equipe.ticket_medio", label="Ticket médio da equipe", domain="equipe",
        description="Faturamento dividido pelas vendas no contrato mensal da equipe.",
        unit="BRL/order", entity="consultor-mês", grain="consultor-mês",
        competence="competência mensal do contrato da equipe",
        deduplication="deduplicação aplicada pela RPC instalada",
        executor="team_performance", value_path=("ticket_medio",),
        dimensions=("consultor", "cidade"), filters=("vendedor", "cidade"),
        aliases=("ticket médio da equipe", "ticket medio da equipe"),
        formula="faturamento / vendas, com base zero preservada", exclusions="conforme RPC vigente",
    ),
    "equipe.meta": MetricDefinition(
        id="equipe.meta", label="Meta da equipe", domain="equipe",
        description="Meta mensal retornada pela RPC vigente da equipe.",
        unit="BRL", entity="consultor-mês", grain="consultor-mês",
        competence="competência mensal do contrato da equipe",
        deduplication="deduplicação aplicada pela RPC instalada",
        executor="team_performance", value_path=("meta",),
        dimensions=("consultor", "cidade"), filters=("vendedor", "cidade"),
        aliases=("meta da equipe", "meta por consultor", "metas"),
        formula="meta retornada pelo contrato vigente", exclusions="conforme RPC vigente",
    ),
    "equipe.conversao": MetricDefinition(
        id="equipe.conversao", label="Conversão da equipe", domain="equipe",
        description="Vendas divididas pelos negócios gerados no contrato mensal da equipe.",
        unit="%", entity="consultor-mês", grain="consultor-mês",
        competence="competência mensal do contrato da equipe",
        deduplication="deduplicação aplicada pela RPC instalada",
        executor="team_performance", value_path=("taxa_conversao_negocios",),
        dimensions=("consultor", "cidade"), filters=("vendedor", "cidade"),
        aliases=("conversão da equipe", "conversao por consultor", "taxa de conversão da equipe"),
        formula="vendas / negócios gerados; base zero permanece nula", exclusions="conforme RPC vigente",
    ),
}


AGENT_METRICS = {
    key: value for key, value in METRICS.items()
    if value.domain in {"vendas", "acoes"}
}
AGENT_METRICS.update(TEAM_METRICS)


def get_agent_metric(metric_id: str) -> MetricDefinition | None:
    # The v2 MVP is intentionally limited to the three approved dashboards.
    # Do not let a broader legacy catalog silently activate Services, Products,
    # Administrative or other concepts before their source contracts are live.
    return AGENT_METRICS.get(metric_id)


def metric_payload(metric_id: str) -> dict[str, Any] | None:
    metric = get_agent_metric(metric_id)
    return metric.as_dict() if metric else None


def catalog_payload() -> list[dict[str, Any]]:
    return [metric.as_dict() for metric in AGENT_METRICS.values()]


def catalog_prompt() -> str:
    return (
        f"CATÁLOGO V2 {CATALOG_VERSION}: "
        "\n".join(
            f"- {metric.id}: {metric.label}. {metric.description} "
            f"Competência: {metric.competence}. Exclusões: {metric.exclusions or 'nenhuma.'}"
            for metric in AGENT_METRICS.values()
        )
        + "\n- equipamentos.vendidos: bloqueado até conciliação viva dos itens de pedidos."
    )
