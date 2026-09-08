"""Deterministic natural-language to validated BI QuerySpec translation."""

from __future__ import annotations

import re
import unicodedata
from typing import Any, Optional

from ya_catalog import METRICS, MetricDefinition, get_metric
from ya_periods import QueryValidationError, _period_from, comparison_for, previous_period
from ya_query_models import QuerySpec
from ya_semantic_filters import question_filters as extract_question_filters, safe_filter


ALLOWED_FILTERS = {
    "categoria", "cidade", "vendedor", "produto", "condicao", "origem", "banco",
    "motivo_perda", "funis", "cliente",
}
NON_DATA_INTENTS = {"explain_metric", "get_freshness", "list_filter_values"}


def normalize_text(value: Any) -> str:
    raw = " ".join(str(value or "").split()).casefold()
    return "".join(
        char for char in unicodedata.normalize("NFD", raw)
        if unicodedata.category(char) != "Mn"
    )


def _contains_term(text: str, term: str) -> bool:
    normalized_term = normalize_text(term).strip()
    return bool(normalized_term) and re.search(rf"(?<!\w){re.escape(normalized_term)}(?!\w)", text) is not None


def _context_dict(context_filters: Any) -> dict[str, Any]:
    if hasattr(context_filters, "model_dump"):
        raw = context_filters.model_dump(by_alias=True, exclude_none=True)
    elif isinstance(context_filters, dict):
        raw = dict(context_filters)
    else:
        raw = {}
    if raw.get("motivoPerda") and not raw.get("motivo_perda"):
        raw["motivo_perda"] = raw["motivoPerda"]
    raw.pop("motivoPerda", None)
    if raw.get("funil") and not raw.get("funis"):
        raw["funis"] = [raw["funil"]]
    raw.pop("funil", None)
    sanitized: dict[str, Any] = {}
    for key, value in raw.items():
        if isinstance(value, str):
            value = safe_filter(value)
        elif isinstance(value, list):
            value = [safe_filter(item) for item in value[:10] if safe_filter(item)]
        if value not in (None, "", [], {}):
            sanitized[key] = value
    return sanitized


def _intent(message: str, planned: dict[str, Any]) -> str:
    proposed = planned.get("intent")
    allowed = {"metric", "breakdown", "timeseries", "compare", "drilldown", "correlation", "entity_360", *NON_DATA_INTENTS}
    if isinstance(proposed, str) and proposed in allowed:
        return proposed
    text = normalize_text(message)
    if any(token in text for token in ("correlac", "associacao", "associação")):
        return "correlation"
    if any(token in text for token in ("mostre os", "quais registros", "detalhe", "drill", "esses clientes", "lista")):
        return "drilldown"
    if any(token in text for token in ("cliente 360", "visao do cliente", "analise do cliente", "dados do cliente")):
        return "entity_360"
    if any(token in text for token in ("valores de filtro", "filtros disponiveis", "filtros disponíveis", "opcoes de filtro", "opções de filtro", "listar vendedores", "listar cidades", "quais vendedores", "quais cidades", "vendedores disponiveis", "vendedores disponíveis", "cidades disponiveis", "cidades disponíveis")):
        return "list_filter_values"
    if any(token in text for token in ("como e calcul", "como é calcul", "definicao", "definição", "o que significa")):
        return "explain_metric"
    if any(token in text for token in ("atualizado", "frescura", "ultima carga", "última carga", "etl")):
        return "get_freshness"
    if any(token in text for token in ("compare", "comparar", "versus", " vs ", " contra ", "variacao", "variação", "comparado", "diferenca entre", "diferença entre")):
        return "compare"
    if any(token in text for token in ("por vendedor", "por consultor", "por cidade", "por produto", "por marca", "por grupo", "por modelo", "por banco", "por etapa", "por status", "por uf", "por tipo", "por motivo", "motivos", "razoes das perdas", "razões das perdas")):
        return "breakdown"
    if any(token in text for token in ("evolucao", "evolução", "ao longo", "mensal", "por mes", "por mês", "serie", "série")):
        return "timeseries"
    return "metric"


def _domain(message: str, route: str, planned: dict[str, Any], state: dict[str, Any]) -> str:
    proposed = planned.get("domain")
    domains = {
        "vendas", "negocios", "acoes", "pedidos", "servicos", "cliente",
        "produtos", "admin", "operacional",
    }
    if isinstance(proposed, str) and proposed in domains:
        return proposed
    text = normalize_text(message)
    route_text = normalize_text(route)
    combined = f"{text} {route_text}"
    if any(_contains_term(combined, token) for token in ("ordem de servico", "ordens de servico", "pos-venda", "pos venda", "os abertas", "os estao", "os por status", "servico", "resolucao")):
        return "servicos"
    if any(_contains_term(combined, token) for token in ("parque", "maquina", "maquinas", "modelo instalado", "marcas instaladas")):
        return "produtos"
    if any(_contains_term(combined, token) for token in ("carteira de clientes", "clientes da carteira", "prospect", "base de clientes", "clientes por uf", "tipo de cliente")):
        return "admin"
    if any(_contains_term(combined, token) for token in ("operacional", "tecnico", "tecnicos", "km rodado", "quilometragem", "agenda", "utilizacao media", "tempo ocioso")):
        return "operacional"
    if any(_contains_term(combined, token) for token in ("pedido aprovado", "pedidos aprovados", "pedido ganho", "pedidos ganhos")):
        return "vendas"
    if any(_contains_term(combined, token) for token in ("pedido", "pedidos", "aprovacao", "aprovado", "financiamento")):
        return "pedidos"
    if any(_contains_term(combined, token) for token in ("acao", "acoes", "visita", "visitas", "oportunidade", "oportunidades")):
        return "acoes"
    if any(_contains_term(combined, token) for token in ("negocio", "negocios", "funil comercial", "pipeline de vendas")):
        return "negocios"
    if any(_contains_term(combined, token) for token in ("funil", "gargalo", "gargalos")):
        return "acoes"
    last = state.get("last_query_spec") if isinstance(state, dict) else None
    if isinstance(last, dict) and last.get("domain") in domains:
        return str(last["domain"])
    return "vendas"


def _metric_ids(message: str, domain: str, planned: dict[str, Any], state: dict[str, Any], intent: str = "") -> list[str]:
    proposed = planned.get("metrics")
    if isinstance(proposed, list) and proposed:
        if not all(isinstance(item, str) and item in METRICS for item in proposed[:2]):
            raise QueryValidationError("A métrica proposta não existe no catálogo vigente.")
        return list(dict.fromkeys(proposed[:2]))
    text = normalize_text(message)
    if domain == "negocios" and any(token in text for token in ("perdid", "perdas")):
        return ["negocios.perdidos"]
    if domain == "servicos" and any(token in text for token in ("os abertas", "os estao", "os estão")):
        return ["servicos.os_abertas"]
    if domain == "servicos" and "os por status" in text:
        return ["servicos.total_os"]
    if domain == "admin" and "cliente" in text:
        return ["admin.total_clientes"]
    if domain == "operacional" and "agenda" in text:
        return ["operacional.eventos_agenda"]
    matches: list[tuple[int, str]] = []
    for metric in METRICS.values():
        if metric.domain != domain:
            continue
        for alias in metric.aliases:
            alias_text = normalize_text(alias)
            if alias_text and alias_text in text:
                matches.append((len(alias_text), metric.id))
    if matches:
        ordered = [item[1] for item in sorted(matches, reverse=True)]
        unique = list(dict.fromkeys(ordered))
        return unique[:2] if intent == "correlation" else unique[:1]
    last = state.get("last_query_spec") if isinstance(state, dict) else None
    if isinstance(last, dict) and isinstance(last.get("metrics"), list):
        previous = [item for item in last["metrics"] if isinstance(item, str) and item in METRICS]
        if previous:
            return previous[:2]
    return []


def _dimension(message: str, domain: str, planned: dict[str, Any]) -> list[str]:
    proposed = planned.get("dimensions")
    if isinstance(proposed, list) and proposed:
        return [item for item in proposed[:2] if isinstance(item, str)]
    text = normalize_text(message)
    if domain == "produtos":
        if any(term in text for term in ("modelo", "modelos")):
            return ["modelo"]
        if any(term in text for term in ("marca", "marcas")):
            return ["marca"]
        if any(term in text for term in ("grupo", "grupos")):
            return ["grupo"]
    if domain == "admin":
        if any(term in text for term in ("tipo de cliente", "tipo cliente")):
            return ["tipo_cliente"]
        if any(term in text for term in ("uf", "estado", "estados")):
            return ["uf"]
        if any(term in text for term in ("consultor", "vendedor")):
            return ["consultor"]
    if domain == "operacional":
        if any(term in text for term in ("tecnico", "técnico", "tecnicos", "técnicos")):
            return ["tecnico"]
        if "status" in text or "situacao" in text or "situação" in text:
            return ["status"]
        if "tipo" in text:
            return ["tipo"]
    options = (
        ("consultor", ("consultor", "vendedor")),
        ("cidade", ("cidade", "regiao", "região", "uf")),
        ("produto", ("produto", "marca", "grupo")),
        ("banco", ("banco", "financiamento")),
        ("motivo_perda", ("motivo de perda", "motivo perda", "motivos", "razões", "razoes", "por que perdemos", "perdemos por")),
        ("etapa", ("etapa", "estagio", "estágio")),
        ("status", ("status", "situacao", "situação")),
    )
    for dimension, terms in options:
        if any(normalize_text(term) in text for term in terms):
            if dimension == "consultor":
                return ["consultor" if domain in {"acoes", "negocios"} else "vendedor"]
            return [dimension]
    return []


def _planner_filters(planned: dict[str, Any]) -> dict[str, Any]:
    raw = planned.get("filters")
    if not isinstance(raw, dict):
        return {}
    result: dict[str, Any] = {}
    for key, value in raw.items():
        normalized_key = "motivo_perda" if key in {"motivoPerda", "motivo-perda"} else key
        if normalized_key not in ALLOWED_FILTERS:
            continue
        if normalized_key == "funil" and isinstance(value, str):
            normalized_key, value = "funis", [value]
        if normalized_key == "funis" and isinstance(value, str):
            value = [value]
        if normalized_key == "funis" and isinstance(value, list):
            value = [safe_filter(item) for item in value[:10] if safe_filter(item)]
        elif isinstance(value, str):
            value = safe_filter(value)
        if value:
            result[normalized_key] = value
    return result


def _entity(message: str, planned: dict[str, Any], state: dict[str, Any]) -> dict[str, str] | None:
    candidate = planned.get("entity")
    if isinstance(candidate, dict):
        name = safe_filter(candidate.get("name"), 120)
        if name:
            return {"type": safe_filter(candidate.get("type"), 40) or "cliente", "name": name}
    match = re.search(r"(?:cliente|da empresa)\s+(?!360(?:\b|$))([\wÀ-ÿ][\wÀ-ÿ .&'-]{1,100})", message, flags=re.IGNORECASE)
    if match:
        return {"type": "cliente", "name": " ".join(match.group(1).split()).rstrip("?.!,")}
    previous = state.get("last_entity") if isinstance(state, dict) else None
    return previous if isinstance(previous, dict) else None


def _safe_limit(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 10


def _apply_validation(spec: QuerySpec) -> QuerySpec:
    if spec.intent in NON_DATA_INTENTS:
        return spec
    if spec.intent == "entity_360":
        if not spec.entity:
            spec.clarification = "Qual cliente você quer consultar? Informe o nome para eu resolver a entidade com segurança."
        return spec
    if not spec.metrics:
        spec.clarification = "Qual métrica você quer analisar? Posso consultar faturamento, pedidos, visitas, perdas, pipeline ou serviços com o período e os filtros informados."
        return spec
    definitions = [get_metric(metric_id) for metric_id in spec.metrics]
    if any(item is None for item in definitions):
        raise QueryValidationError("Uma das métricas solicitadas não existe no catálogo vigente.")
    assert all(isinstance(item, MetricDefinition) for item in definitions)
    snapshot_definitions = [item for item in definitions if not item.period_required]
    if snapshot_definitions:
        if spec.intent in {"compare", "timeseries", "correlation", "drilldown"}:
            spec.clarification = (
                f"{snapshot_definitions[0].label} é um snapshot atual e não possui histórico temporal "
                "no contrato vigente. Escolha uma consulta de estado atual."
            )
            return spec
        spec.period = None
        spec.comparison = None
        spec.warnings.append("A métrica solicitada é um snapshot atual; o período da tela não foi aplicado.")
    if spec.intent == "correlation" and len(definitions) != 2:
        spec.clarification = "Para calcular uma associação, informe duas métricas compatíveis e o grão da comparação."
        return spec
    if spec.intent == "correlation" and definitions[1].id not in definitions[0].compatible_with:
        spec.clarification = "Essas métricas não têm compatibilidade declarada no catálogo para correlação."
        return spec
    if spec.intent != "correlation" and len(definitions) > 1:
        spec.metrics = spec.metrics[:1]
        definitions = definitions[:1]
    if spec.dimensions:
        unsupported_dimensions = [
            dimension for dimension in spec.dimensions
            if any(dimension not in item.dimensions for item in definitions)
        ]
        if unsupported_dimensions:
            spec.clarification = (
                f"A dimensão {unsupported_dimensions[0]} não está disponível para "
                f"{definitions[0].label.lower()} no contrato atual."
            )
            return spec
    supported_filters = set.intersection(*(set(item.filters) for item in definitions)) if definitions else set()
    unsupported_filters = [key for key in spec.requested_filters if key not in supported_filters]
    if unsupported_filters:
        names = {"categoria": "categoria", "funis": "funil", "motivo_perda": "motivo de perda"}
        spec.clarification = (
            f"O filtro {names.get(unsupported_filters[0], unsupported_filters[0])} "
            f"não é suportado pelo contrato de {definitions[0].label.lower()}. "
            "Remova esse filtro ou escolha uma métrica compatível."
        )
        return spec
    if spec.intent == "correlation" and definitions[0].domain != definitions[1].domain:
        spec.clarification = "As métricas pertencem a domínios com coortes diferentes; não vou calcular uma associação sem chave comum."
    return spec


def build_query_spec(
    message: str,
    *,
    route: str = "/bi/painel",
    context_filters: Any = None,
    memory_state: Optional[dict[str, Any]] = None,
    planned: Optional[dict[str, Any]] = None,
) -> QuerySpec:
    clean_message = " ".join(message.split())[:2_000]
    state = memory_state or {}
    proposal = planned if isinstance(planned, dict) else {}
    context = _context_dict(context_filters)
    planner_filters = _planner_filters(proposal)
    previous_spec = state.get("last_query_spec") if isinstance(state, dict) else {}
    previous_filters = previous_spec.get("requested_filters", {}) if isinstance(previous_spec, dict) else {}
    inherited_filters = previous_filters if isinstance(previous_filters, dict) else {}
    requested_filters = {
        key: value for key, value in {**inherited_filters, **context, **planner_filters}.items()
        if key not in {"from", "to"} and value not in (None, "", [], {})
    }
    previous_origins = previous_spec.get("filter_origins", {}) if isinstance(previous_spec, dict) else {}
    filter_origins = {
        key: str(previous_origins.get(key, "conversation"))
        for key in inherited_filters
        if key in requested_filters
    }
    filter_origins.update({key: "screen" for key in context if key not in {"from", "to"}})
    filter_origins.update({key: "question" for key in planner_filters})
    period = _period_from(context, state, proposal, clean_message)
    intent = _intent(clean_message, proposal)
    domain = _domain(clean_message, route, proposal, state)
    natural_filters = extract_question_filters(clean_message, domain)
    for key, value in natural_filters.items():
        requested_filters.setdefault(key, value)
    filter_origins.update({key: "question" for key in natural_filters if key in requested_filters})
    if intent == "entity_360":
        domain = "cliente"
    metrics = [] if intent in {"get_freshness", "list_filter_values", "entity_360"} else _metric_ids(clean_message, domain, proposal, state, intent)
    dimensions = _dimension(clean_message, domain, proposal)
    entity = _entity(clean_message, proposal, state)
    if intent == "entity_360" and entity:
        requested_filters["cliente"] = entity["name"]
    effective_filters = {key: value for key, value in requested_filters.items() if value}
    comparison = comparison_for(clean_message, period) if intent == "compare" else None
    drilldown_ref = state.get("last_drilldown_ref") if intent == "drilldown" else None
    output = {"breakdown": "table", "timeseries": "series", "drilldown": "table", "correlation": "text"}.get(intent, "metric")
    proposed_order = proposal.get("order_by")
    if proposed_order is not None and (not isinstance(proposed_order, str) or proposed_order not in {"value_desc", "value_asc", "name_asc"}):
        raise QueryValidationError("A ordenação proposta não é suportada pelo catálogo vigente.")
    spec = QuerySpec(
        intent=intent,
        domain=domain,
        metrics=metrics,
        period=None if intent == "get_freshness" else period,
        comparison=comparison,
        filters=effective_filters,
        requested_filters=requested_filters,
        dimensions=dimensions,
        order_by=proposed_order if isinstance(proposed_order, str) else ("value_desc" if dimensions else None),
        limit=min(max(_safe_limit(proposal.get("limit", 10)), 1), 50),
        entity=entity,
        output=output,
        drilldown_ref=drilldown_ref,
        filter_origins=filter_origins,
    )
    return _apply_validation(spec)
