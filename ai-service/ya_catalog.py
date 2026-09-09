"""Versioned semantic catalog used by the BI query gateway."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


CATALOG_VERSION = "2026-09-08.1"


@dataclass(frozen=True)
class MetricDefinition:
    id: str
    label: str
    domain: str
    description: str
    unit: str
    entity: str
    grain: str
    competence: str
    deduplication: str
    executor: str
    value_path: tuple[str, ...]
    dimensions: tuple[str, ...]
    filters: tuple[str, ...]
    aliases: tuple[str, ...]
    formula: str = ""
    compatible_with: tuple[str, ...] = ()
    status: str = "available"
    drilldown_kind: str | None = None
    series_path: tuple[str, ...] = ()
    exclusions: str = ""
    dimension_paths: dict[str, tuple[str, ...]] | None = None
    period_required: bool = True

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "version": CATALOG_VERSION,
            "label": self.label,
            "domain": self.domain,
            "definition": self.description,
            "unit": self.unit,
            "entity": self.entity,
            "grain": self.grain,
            "competence": self.competence,
            "deduplication": self.deduplication,
            "executor": self.executor,
            "dimensions": list(self.dimensions),
            "filters": list(self.filters),
            "formula": self.formula or self.description,
            "compatible_with": list(self.compatible_with),
            "status": self.status,
            "drilldown": self.drilldown_kind,
            "exclusions": self.exclusions,
            "dimension_paths": {key: list(value) for key, value in (self.dimension_paths or {}).items()},
            "period_required": self.period_required,
        }


def _metric(
    metric_id: str,
    label: str,
    domain: str,
    description: str,
    unit: str,
    entity: str,
    grain: str,
    competence: str,
    deduplication: str,
    executor: str,
    value_path: tuple[str, ...],
    dimensions: tuple[str, ...],
    filters: tuple[str, ...],
    aliases: tuple[str, ...],
    *,
    formula: str = "",
    compatible_with: tuple[str, ...] = (),
    status: str = "available",
    drilldown_kind: str | None = None,
    series_path: tuple[str, ...] = (),
    exclusions: str = "",
    dimension_paths: dict[str, tuple[str, ...]] | None = None,
    period_required: bool = True,
) -> MetricDefinition:
    return MetricDefinition(
        id=metric_id,
        label=label,
        domain=domain,
        description=description,
        unit=unit,
        entity=entity,
        grain=grain,
        competence=competence,
        deduplication=deduplication,
        executor=executor,
        value_path=value_path,
        dimensions=dimensions,
        filters=filters,
        aliases=aliases,
        formula=formula or description,
        compatible_with=compatible_with,
        status=status,
        drilldown_kind=drilldown_kind,
        series_path=series_path,
        exclusions=exclusions,
        dimension_paths=dimension_paths,
        period_required=period_required,
    )


SALES_GAIN_FILTERS = ("vendedor", "cidade", "produto", "condicao", "origem", "banco", "funis")
SALES_LOSS_FILTERS = ("vendedor", "cidade", "produto", "condicao", "origem", "motivo_perda", "funis")
SALES_PIPELINE_FILTERS = ("vendedor", "cidade", "produto", "condicao", "origem", "funis")
SALES_GAIN_DIMENSIONS = ("vendedor", "cidade", "produto", "origem", "banco", "tipo_cliente")
SALES_LOSS_DIMENSIONS = ("vendedor", "cidade", "produto", "origem", "motivo_perda")
BUSINESS_FILTERS = ("vendedor", "cidade", "funis")
BUSINESS_TOTAL_DIMENSIONS = ("etapa", "origem", "consultor")
METRICS: dict[str, MetricDefinition] = {
    "vendas.faturamento": _metric(
        "vendas.faturamento", "Faturamento aprovado", "vendas",
        "Soma do valor dos pedidos aprovados ligados a negócios ganhos.", "BRL", "pedido", "pedido",
        "aprovação do pedido (pdo_dthaprovacao; fallback documentado pela RPC)",
        "pedido distinto por pdo_codigointerno", "sales_overview", ("kpis", "faturamento"),
        SALES_GAIN_DIMENSIONS, SALES_GAIN_FILTERS, ("faturamento", "receita", "valor vendido", "vendas"),
        series_path=("serieMensal",),
        exclusions="negócio canônico; sem REPASSE DE MAQUINA",
    ),
    "vendas.pedidos_aprovados": _metric(
        "vendas.pedidos_aprovados", "Pedidos aprovados", "vendas",
        "Quantidade de pedidos aprovados ligados a negócios ganhos.", "count", "pedido", "pedido",
        "aprovação do pedido", "pedido distinto por pdo_codigointerno", "sales_overview",
        ("kpis", "totalPedidos"), SALES_GAIN_DIMENSIONS, SALES_GAIN_FILTERS,
        ("pedidos aprovados", "quantos pedidos", "volume de vendas"),
        series_path=("serieMensal",),
        exclusions="negócio canônico; sem REPASSE DE MAQUINA",
    ),
    "vendas.ticket_medio": _metric(
        "vendas.ticket_medio", "Ticket médio", "vendas",
        "Faturamento aprovado dividido pela quantidade de pedidos aprovados.", "BRL/order", "pedido", "pedido",
        "aprovação do pedido", "pedido distinto por pdo_codigointerno", "sales_overview",
        ("kpis", "ticketMedio"), SALES_GAIN_DIMENSIONS, SALES_GAIN_FILTERS,
        ("ticket medio", "ticket médio", "valor médio por pedido"), series_path=("serieMensal",),
    ),
    "vendas.valor_perdido": _metric(
        "vendas.valor_perdido", "Valor perdido", "vendas",
        "Soma do valor negociado de negócios perdidos no fechamento.", "BRL", "negócio", "negócio",
        "fechamento do negócio (ngo_datafechamento)", "negócio canônico por ngo_numero", "sales_overview",
        ("kpis", "valorPerdido"), SALES_LOSS_DIMENSIONS, SALES_LOSS_FILTERS,
        ("valor perdido", "perdas em valor", "perda financeira"),
        dimension_paths={
            "vendedor": ("perdas", "rankingVendedores"), "cidade": ("perdas", "rankingCidades"),
            "produto": ("perdas", "rankingProdutos"), "origem": ("perdas", "origensLead"),
            "motivo_perda": ("perdas", "motivosPerda"),
        },
        exclusions="negócio canônico; sem REPASSE DE MAQUINA",
    ),
    "vendas.negocios_perdidos": _metric(
        "vendas.negocios_perdidos", "Negócios perdidos", "vendas",
        "Quantidade de negócios canônicos com conclusão Perdido.", "count", "negócio", "negócio",
        "fechamento do negócio (ngo_datafechamento)", "negócio canônico por ngo_numero", "sales_overview",
        ("kpis", "totalPerdido"), SALES_LOSS_DIMENSIONS, SALES_LOSS_FILTERS,
        ("negócios perdidos", "negocios perdidos", "perdas", "quantas perdas"),
        dimension_paths={
            "vendedor": ("perdas", "rankingVendedores"), "cidade": ("perdas", "rankingCidades"),
            "produto": ("perdas", "rankingProdutos"), "origem": ("perdas", "origensLead"),
            "motivo_perda": ("perdas", "motivosPerda"),
        },
        exclusions="negócio canônico; sem REPASSE DE MAQUINA",
    ),
    "vendas.pipeline_aberto": _metric(
        "vendas.pipeline_aberto", "Pipeline aberto", "vendas",
        "Valor dos negócios canônicos em andamento no recorte da RPC.", "BRL", "negócio", "negócio",
        "snapshot do estado atual do negócio", "negócio canônico por ngo_numero", "sales_overview",
        ("kpis", "valorEmAndamento"), (), SALES_PIPELINE_FILTERS,
        ("pipeline aberto", "pipeline", "em andamento"), status="snapshot",
        exclusions="sem REPASSE DE MAQUINA; não é fluxo de eventos",
    ),
    "negocios.total": _metric(
        "negocios.total", "Negócios no período", "negocios",
        "Quantidade de negócios canônicos com data de fechamento no período.", "count", "negócio", "negócio",
        "fechamento do negócio (ngo_datafechamento)", "negócio canônico por ngo_numero", "business_analysis",
        ("kpis", "totalNegocios"), BUSINESS_TOTAL_DIMENSIONS, BUSINESS_FILTERS,
        ("total de negócios", "total negocios", "quantidade de negocios", "negócios"),
        series_path=("evolucaoMensal",), exclusions="funis conforme seleção; canonização por ngo_numero",
    ),
    "negocios.ganhos": _metric(
        "negocios.ganhos", "Negócios ganhos", "negocios",
        "Quantidade de negócios canônicos com conclusão Ganho no período.", "count", "negócio", "negócio",
        "fechamento do negócio (ngo_datafechamento)", "negócio canônico por ngo_numero", "business_analysis",
        ("kpis", "ganhos"), (), BUSINESS_FILTERS, ("negócios ganhos", "ganhos de negócios"),
    ),
    "negocios.perdidos": _metric(
        "negocios.perdidos", "Negócios perdidos", "negocios",
        "Quantidade de negócios canônicos com conclusão Perdido no período.", "count", "negócio", "negócio",
        "fechamento do negócio (ngo_datafechamento)", "negócio canônico por ngo_numero", "business_analysis",
        ("kpis", "perdidos"), (), BUSINESS_FILTERS, ("negócios perdidos", "perdidos de negócios"),
    ),
    "negocios.em_andamento": _metric(
        "negocios.em_andamento", "Negócios em andamento", "negocios",
        "Quantidade de negócios canônicos classificados como em andamento no recorte.", "count", "negócio", "negócio",
        "fechamento do negócio no contrato vigente", "negócio canônico por ngo_numero", "business_analysis",
        ("kpis", "andamento"), (), BUSINESS_FILTERS, ("negócios em andamento", "em andamento"), status="snapshot",
    ),
    "negocios.taxa_conversao": _metric(
        "negocios.taxa_conversao", "Taxa de conversão de negócios", "negocios",
        "Negócios ganhos divididos pelo total de negócios do contrato.", "%", "negócio", "negócio",
        "fechamento do negócio (ngo_datafechamento)", "negócio canônico por ngo_numero", "business_analysis",
        ("kpis", "taxaConversao"), (), BUSINESS_FILTERS, ("taxa de conversão de negócios", "conversão de negócios"),
    ),
    "negocios.pipeline_aberto": _metric(
        "negocios.pipeline_aberto", "Pipeline aberto de negócios", "negocios",
        "Valor negociado dos negócios não classificados como perdidos no recorte.", "BRL", "negócio", "negócio",
        "fechamento do negócio (ngo_datafechamento)", "negócio canônico por ngo_numero", "business_analysis",
        ("kpis", "pipelineAberto"), (), BUSINESS_FILTERS, ("pipeline aberto de negócios", "pipeline de negócios"),
        status="snapshot", exclusions="não é soma de pedidos aprovados; contrato de negócios",
    ),
    "negocios.valor_ganho": _metric(
        "negocios.valor_ganho", "Valor ganho em negócios", "negocios",
        "Valor negociado dos negócios canônicos com conclusão Ganho.", "BRL", "negócio", "negócio",
        "fechamento do negócio (ngo_datafechamento)", "negócio canônico por ngo_numero", "business_analysis",
        ("kpis", "valorGanho"), (), BUSINESS_FILTERS, ("valor ganho em negócios", "receita de negócios"),
    ),
    "negocios.ticket_medio_ganho": _metric(
        "negocios.ticket_medio_ganho", "Ticket médio de negócio ganho", "negocios",
        "Valor ganho dividido pela quantidade de negócios ganhos.", "BRL/business", "negócio", "negócio",
        "fechamento do negócio (ngo_datafechamento)", "negócio canônico por ngo_numero", "business_analysis",
        ("kpis", "ticketMedioGanho"), (), BUSINESS_FILTERS, ("ticket médio de negócio", "ticket médio ganho"),
    ),
    "acoes.visitas": _metric(
        "acoes.visitas", "Visitas concluídas", "acoes",
        "Quantidade de ações classificadas como visita no período.", "count", "ação", "ação",
        "conclusão da ação (aco_dthconclusao)", "cada ação registrada", "funnel", ("funil", "visitas"),
        ("consultor",), ("vendedor", "cidade"), ("visitas", "visitas realizadas", "contatos presenciais"),
        compatible_with=("acoes.oportunidades", "acoes.ganhos", "acoes.perdidos"),
        drilldown_kind="acoes",
    ),
    "acoes.oportunidades": _metric(
        "acoes.oportunidades", "Oportunidades tocadas", "acoes",
        "Negócios que entraram na etapa de oportunidade conforme o funil de Ações.", "count", "negócio", "negócio",
        "primeira entrada na etapa oportunidade", "negócio canônico no contrato do funil", "funnel",
        ("funil", "oportunidades"), ("consultor",), ("vendedor", "cidade"),
        ("oportunidades", "oportunidade"),
        compatible_with=("acoes.visitas", "acoes.ganhos", "acoes.perdidos"),
        drilldown_kind="acoes",
    ),
    "acoes.ganhos": _metric(
        "acoes.ganhos", "Ganhos de Ações", "acoes",
        "Pedidos aprovados ligados a negócios ganhos no contrato do funil de Ações.", "count", "pedido", "pedido",
        "aprovação do pedido", "pedido distinto por pdo_codigointerno", "funnel", ("funil", "ganhos"),
        ("consultor",), ("vendedor", "cidade"), ("ganhos", "vendas ganhas", "fechamentos ganhos"),
        compatible_with=("acoes.visitas", "acoes.oportunidades", "acoes.perdidos"),
        drilldown_kind="pedidos_ganhos",
        exclusions="sem REPASSE DE MAQUINA; atribuição conforme contrato do funil",
    ),
    "acoes.perdidos": _metric(
        "acoes.perdidos", "Perdas de Ações", "acoes",
        "Negócios perdidos no fechamento dentro do contrato do funil de Ações.", "count", "negócio", "negócio",
        "fechamento do negócio", "negócio canônico por ngo_numero", "funnel", ("funil", "perdidos"),
        ("consultor",), ("vendedor", "cidade"), ("perdidos", "perdas", "negócios perdidos"),
        compatible_with=("acoes.visitas", "acoes.oportunidades", "acoes.ganhos"),
        drilldown_kind="negocios_perdidos",
        exclusions="sem REPASSE DE MAQUINA; atribuição conforme contrato do funil",
    ),
    "acoes.pipeline_aberto": _metric(
        "acoes.pipeline_aberto", "Pipeline trabalhado", "acoes",
        "Valor do pipeline aberto tocado por ações no período.", "BRL", "negócio", "negócio",
        "ação concluída no período + estado Em Andamento", "negócio canônico por ngo_numero", "funnel",
        ("funil", "valorPipelineAbertoTocadoNoPeriodo"), ("consultor",), ("vendedor", "cidade"),
        ("pipeline de ações", "pipeline trabalhado"), status="available",
        exclusions="sem REPASSE DE MAQUINA; não somar a ganhos/perdas",
    ),
    "pedidos.faturamento": _metric(
        "pedidos.faturamento", "Faturamento de pedidos aprovados", "pedidos",
        "Soma de pdo_vlrpedido para pedidos classificados como aprovados.", "BRL", "pedido", "pedido",
        "data do pedido (pdo_dthpedido) no RPC de pedidos", "linha do contrato rpc_pedidos_bi", "orders",
        ("kpis", "faturamento"), ("vendedor", "cidade", "status"), ("vendedor", "cidade"),
        ("faturamento de pedidos", "valor dos pedidos"), series_path=("evolucaoMensal",),
    ),
    "pedidos.total": _metric(
        "pedidos.total", "Pedidos registrados", "pedidos",
        "Quantidade de pedidos no período do contrato de pedidos.", "count", "pedido", "pedido",
        "data do pedido (pdo_dthpedido)", "linha do contrato rpc_pedidos_bi", "orders", ("kpis", "total"),
        ("vendedor", "cidade", "status"), ("vendedor", "cidade"), ("total de pedidos", "pedidos"),
        series_path=("evolucaoMensal",),
    ),
    "pedidos.percentual_aprovado": _metric(
        "pedidos.percentual_aprovado", "Percentual aprovado", "pedidos",
        "Pedidos aprovados dividido pelo total de pedidos do contrato.", "%", "pedido", "pedido",
        "data do pedido (pdo_dthpedido)", "linha do contrato rpc_pedidos_bi", "orders",
        ("kpis", "percentAprovado"), ("vendedor", "cidade", "status"), ("vendedor", "cidade"),
        ("percentual aprovado", "taxa de aprovação", "aprovacao"),
    ),
    "servicos.total_os": _metric(
        "servicos.total_os", "Ordens de serviço", "servicos",
        "Quantidade de OS abertas no período do contrato de serviços.", "count", "OS", "OS",
        "abertura da OS (os_dthabertura)", "uma linha por OS no mirror", "after_sales", ("kpis", "totalOS"),
        ("status",), ("cidade",), ("total de OS", "ordens de serviço", "ordem de serviço"),
        series_path=("evolucaoAberturas",),
    ),
    "servicos.os_abertas": _metric(
        "servicos.os_abertas", "OS abertas", "servicos",
        "Quantidade de OS com status aberto no período.", "count", "OS", "OS",
        "abertura da OS (os_dthabertura)", "uma linha por OS no mirror", "after_sales", ("kpis", "abertas"),
        ("status",), ("cidade",), ("OS abertas", "ordens abertas"),
    ),
    "servicos.taxa_fechamento": _metric(
        "servicos.taxa_fechamento", "Taxa de fechamento de OS", "servicos",
        "OS fechadas divididas pelo total de OS no período.", "%", "OS", "OS",
        "abertura da OS (os_dthabertura)", "uma linha por OS no mirror", "after_sales",
        ("kpis", "taxaFechamento"), ("status",), ("cidade",), ("taxa de fechamento", "fechamento de OS"),
    ),
    "servicos.tempo_medio_resolucao": _metric(
        "servicos.tempo_medio_resolucao", "Tempo médio de resolução", "servicos",
        "Média de dias entre abertura e encerramento das OS encerradas.", "days", "OS", "OS",
        "abertura da OS (os_dthabertura)", "uma linha por OS no mirror", "after_sales",
        ("kpis", "tempoMedioResolucao"), ("status",), ("cidade",),
        ("tempo médio de resolução", "tempo de resolução", "dias para resolver"),
    ),
}


# Phase 4 contracts are maintained in a separate module so the core catalog
# stays reviewable. The extension is imported only after MetricDefinition and
# the first-period contracts have been initialized.
from ya_catalog_extensions import SNAPSHOT_METRIC_SPECS  # noqa: E402

METRICS.update({key: MetricDefinition(**value) for key, value in SNAPSHOT_METRIC_SPECS.items()})


EXECUTOR_LABELS = {
    "sales_overview": "Vendas e resultados",
    "business_analysis": "Negócios e funil comercial",
    "funnel": "Funil e esforço comercial",
    "orders": "Pedidos e mix de pagamento",
    "after_sales": "Pós-venda e serviços",
    "field_signals": "Sinais de campo",
    "client_360": "Cliente 360",
    "products_snapshot": "Produtos e parque instalado",
    "admin_snapshot": "Carteira e administração",
    "operational_snapshot": "Operacional e agenda",
}

EXECUTOR_TABLES = {
    "sales_overview": ["mirror.crm_pedidos", "mirror.crm_negocios"],
    "business_analysis": ["mirror.crm_negocios", "mirror.crm_funil_etapa"],
    "funnel": ["mirror.crm_acoes", "mirror.crm_negocios", "mirror.crm_pedidos"],
    "orders": ["mirror.crm_pedidos", "mirror.crm_pedidos_item"],
    "after_sales": ["mirror.ordens_servico"],
    "client_360": ["mirror.crm_carteira_clientes", "mirror.crm_acoes", "mirror.crm_negocios", "mirror.crm_pedidos", "mirror.cliente_parque_maquinas", "mirror.ordens_servico"],
    "products_snapshot": ["mirror.cliente_parque_maquinas"],
    "admin_snapshot": ["mirror.crm_carteira_clientes"],
}

CAPABILITIES = {
    "get_metric": "KPI único ou conjunto compacto com escopo e definição.",
    "get_breakdown": "Quebra de uma métrica por uma dimensão aprovada.",
    "get_timeseries": "Evolução mensal de uma métrica em uma série existente.",
    "compare_periods": "Comparação de janelas equivalentes com filtros idênticos.",
    "drill_down": "Lista paginada de registros da mesma coorte do agregado.",
    "get_entity_360": "Visão de um cliente resolvido sem expor documentos de contato.",
    "correlate": "Associação calculada apenas quando as medidas compartilham coorte válida.",
    "explain_metric": "Definição normativa do catálogo sem usar resultado corrente.",
    "get_freshness": "Estado de atualização do mirror/ETL.",
    "list_filter_values": "Valores canônicos para desambiguação de filtros.",
    "open_data_query": "Consulta exploratória somente leitura nas tabelas mirror quando o catálogo não cobre a pergunta.",
    "conversation": "Conversa natural, saudações e orientação sobre o Ceres BI sem inventar dados.",
    "source": "Explicação da fonte e do escopo da última evidência registrada.",
}


def get_metric(metric_id: str) -> MetricDefinition | None:
    return METRICS.get(metric_id)


def catalog_prompt() -> str:
    lines = [f"Catálogo {CATALOG_VERSION}:"]
    for item in METRICS.values():
        lines.append(
            f"- {item.id}: {item.description} Unidade: {item.unit}; competência: {item.competence}; "
            f"fórmula: {item.formula}; dimensões: {', '.join(item.dimensions) or 'nenhuma'}; status: {item.status}."
        )
    return "\n".join(lines)
