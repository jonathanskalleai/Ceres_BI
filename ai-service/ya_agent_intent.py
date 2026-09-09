"""Semantic turn contracts for the conversational BI agent.

The model is allowed to interpret the user's language, but it is not allowed
to choose the period or the evidence contract by itself.  This module turns a
small structured interpretation into server-authoritative requirements that
the tool loop can enforce.
"""

from __future__ import annotations

import json
import logging
from dataclasses import replace
from datetime import date, datetime
from typing import Any, Awaitable, Callable
from zoneinfo import ZoneInfo

from ai_logger import log_event
from ya_agent_classifier_prompt import CLASSIFIER_SYSTEM
from ya_agent_contract import ContractResolution, TurnContract
from ya_agent_periods import comparison_choices, mentions_previous, resolve_comparison, resolve_period
from ya_models import YaChatRequest, YaSource


BUSINESS_TIMEZONE = ZoneInfo("America/Sao_Paulo")


Classifier = Callable[..., Awaitable[Any]]


async def resolve_turn(
    request: YaChatRequest,
    state: dict[str, Any],
    last_sources: list[YaSource],
    *,
    classifier: Classifier | None,
    session_id: str,
) -> ContractResolution:
    """Resolve a turn through the model and then apply deterministic guardrails."""
    if classifier is None:
        # Custom providers are used by unit tests and local adapters. They do
        # not have a semantic classifier; keep that compatibility path free of
        # business assumptions and let their explicit tool response drive the
        # test. Production always supplies ``complete_structured``.
        return ContractResolution(_compatibility_contract())
    today = datetime.now(BUSINESS_TIMEZONE).date()
    try:
        response = await classifier(
            [
                {"role": "system", "content": CLASSIFIER_SYSTEM},
                {"role": "user", "content": _classifier_context(request, state, last_sources, today)},
            ],
            temperature=0.0,
            max_tokens=420,
            json_mode=True,
            session_id=session_id,
        )
        content, usage = _classifier_content(response)
        raw = _parse_classifier(content)
        if raw is None or not isinstance(raw.get("intent"), str) or not raw.get("intent", "").strip():
            raise ValueError("interpretação sem JSON válido")
        contract = _build_contract(raw, request, state, last_sources, today)
        return ContractResolution(
            contract,
            raw,
            _usage_int(usage, "prompt_tokens", "input_tokens"),
            _usage_int(usage, "completion_tokens", "output_tokens"),
        )
    except Exception as error:
        fallback_raw = _deterministic_fallback(request, state, last_sources)
        if fallback_raw:
            try:
                fallback_contract = replace(
                    _build_contract(fallback_raw, request, state, last_sources, today),
                    classifier_status="fallback",
                )
                log_event(logging.WARNING, "ai_agent_intent_deterministic_fallback", intent=fallback_contract.intent)
                return ContractResolution(fallback_contract, fallback_raw)
            except Exception as fallback_error:
                log_event(logging.ERROR, "ai_agent_intent_fallback_failed", error_type=type(fallback_error).__name__)
        log_event(logging.ERROR, "ai_agent_intent_resolution_failed", error_type=type(error).__name__)
        return ContractResolution(
            TurnContract(
                intent="clarify",
                domain="conversation",
                choices=(),
                clarification_text="Não consegui interpretar o recorte com segurança. Pode reformular a pergunta?",
                resolution_status="unavailable",
                classifier_status="unavailable",
            ),
        )


def _classifier_context(request: YaChatRequest, state: dict[str, Any], sources: list[YaSource], today: date) -> str:
    scopes = []
    for source in sources[:5]:
        applied = source.applied_scope if isinstance(source.applied_scope, dict) else {}
        scopes.append({"label": source.label, "period": applied.get("period"), "comparison": applied.get("comparacao")})
    context = {
        "data_servidor": today.isoformat(),
        "pergunta": request.message.strip()[:2_000],
        "filtros_tela": request.context.filters.model_dump(by_alias=True, exclude_none=True),
        "assunto_ativo": state.get("active_topic"),
        "estado_assuntos": state.get("topics", {}),
        "clarificacao_pendente": state.get("pending_clarification"),
        "ultimas_fontes": scopes,
    }
    return json.dumps(context, ensure_ascii=False, default=str)


def _classifier_content(response: Any) -> tuple[str, dict[str, Any]]:
    if isinstance(response, str):
        return response, {}
    if isinstance(response, dict):
        content = response.get("content")
        if isinstance(content, str):
            usage = response.get("usage") if isinstance(response.get("usage"), dict) else {}
            return content, usage
        message = response.get("message")
        if isinstance(message, dict) and isinstance(message.get("content"), str):
            usage = response.get("usage") if isinstance(response.get("usage"), dict) else {}
            return message["content"], usage
    raise ValueError("resposta do classificador inválida")


def _deterministic_fallback(request: YaChatRequest, state: dict[str, Any], sources: list[YaSource]) -> dict[str, Any] | None:
    """Recover only high-confidence intents when the classifier output is unusable.

    This fallback never selects a number, SQL statement or tool arguments. It
    only keeps unmistakable comparison/loss questions on their server-owned
    evidence path instead of turning a transient model-format failure into a
    misleading generic clarification.
    """
    message = request.message.casefold()
    comparison = any(fragment in message for fragment in ("comparad", "compare", "comparar", "versus", " x ", "diferença entre", "diferenca entre"))
    previous = mentions_previous(message)
    if comparison and previous:
        return {
            "intent": "sales_comparison",
            "domain": "vendas",
            "period_request": "current_to_date",
            "comparison_scope": _comparison_scope("", message),
            "metricas": [],
            "presentation": "tabela",
        }

    if any(fragment in message for fragment in ("perdas", "percas", "negócios perdidos", "negocios perdidos")):
        detail = any(fragment in message for fragment in ("detalh", "mais sobre", "motivo", "vendedor", "cidade", "produto"))
        period_request = "inherit" if _has_sales_context(state, sources) else "current_to_date"
        return {
            "intent": "loss_details" if detail else "loss_diagnosis",
            "domain": "vendas",
            "period_request": period_request,
            "comparison_scope": "none",
            "metricas": [],
            "presentation": "tabela",
        }
    return None


def _has_sales_context(state: dict[str, Any], sources: list[YaSource]) -> bool:
    topics = state.get("topics") if isinstance(state, dict) else None
    if isinstance(topics, dict) and isinstance(topics.get("vendas"), dict) and topics["vendas"].get("period"):
        return True
    return any(source.intent in {"agent_tool", "sales", "vendas"} for source in sources[:5])


def _parse_classifier(content: str) -> dict[str, Any] | None:
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        start, end = content.find("{"), content.rfind("}")
        if start < 0 or end <= start:
            return None
        try:
            parsed = json.loads(content[start : end + 1])
        except json.JSONDecodeError:
            return None
    return parsed if isinstance(parsed, dict) else None


def _build_contract(raw: dict[str, Any], request: YaChatRequest, state: dict[str, Any], sources: list[YaSource], today: date) -> TurnContract:
    message = request.message.casefold()
    intent = _semantic_intent_override(_intent(raw.get("intent")), message)
    domain = _domain(raw.get("domain"), intent)
    scope = _comparison_scope(raw.get("comparison_scope"), message)
    period_request = str(raw.get("period_request") or "none")
    metrics = _metrics(raw.get("metricas"), intent, domain)
    presentation = str(raw.get("presentation") or "texto")
    if presentation not in {"texto", "tabela", "barras", "linha", "kpi_group"}:
        presentation = "texto"
    funnel_mode = _funnel_mode(request, raw, message)
    filters = _safe_filters(request, raw)
    if intent == "casual":
        return TurnContract(intent="casual", classifier_status="model")
    if intent == "sales_comparison" and scope == "ask":
        choices = comparison_choices(today)
        return TurnContract(
            intent="clarify",
            domain="vendas",
            metrics=tuple(metrics),
            filters=filters,
            funnel_mode=funnel_mode,
            choices=tuple(choices),
            clarification_text="Para comparar este mês até agora com o mês passado, qual cobertura você prefere?",
            resolution_status="ambiguous",
        )
    if intent in {"sales_summary", "loss_diagnosis", "loss_details"}:
        period = resolve_period(period_request, today, state, sources, message, scope, raw.get("period_start"), raw.get("period_end"), topic=domain)
        if intent == "loss_details":
            blocks = ("perdas", "rankings", "produtos")
        elif intent == "loss_diagnosis":
            blocks = ("perdas", "rankings")
        else:
            blocks = ("kpis", "resumo")
        return TurnContract(
            intent=intent,
            domain="vendas",
            required_tool="consultar_desempenho_vendas",
            required_blocks=blocks,
            metrics=tuple(metrics or _default_sales_metrics(intent)),
            period=period,
            filters=filters,
            funnel_mode=funnel_mode,
            presentation="tabela" if intent in {"loss_diagnosis", "loss_details"} else presentation,
        )
    if intent == "sales_comparison":
        comparison = resolve_comparison(period_request, scope, today, raw)
        comparison_metrics = metrics or _default_comparison_metrics(domain)
        required_tools = ("comparar_periodos",)
        period = None
        required_blocks = ()
        if _needs_product_drilldown(message):
            required_tools = ("comparar_periodos", "consultar_desempenho_vendas")
            period = comparison["atual"]
            required_blocks = ("produtos", "rankings")
        return TurnContract(
            intent=intent,
            domain=domain if domain in {"vendas", "acoes", "equipe"} else "vendas",
            required_tool="comparar_periodos",
            required_tools=required_tools,
            required_blocks=required_blocks,
            metrics=tuple(comparison_metrics),
            comparison=comparison,
            period=period,
            filters=filters,
            funnel_mode=funnel_mode,
            presentation="tabela",
        )
    tool = {
        "actions": "consultar_acoes_comerciais",
        "team": "consultar_desempenho_equipe",
        "correlation": "correlacionar_metricas",
        "concept": "explicar_conceito",
        "freshness": "consultar_atualizacao",
        "memory": _memory_tool(message),
        "exploration": "consultar_banco_bi",
    }.get(intent)
    tool_period = None if intent == "freshness" else resolve_period(period_request, today, state, sources, message, scope, raw.get("period_start"), raw.get("period_end"), topic=domain)
    required_blocks = _action_blocks(message, raw) if intent == "actions" else ()
    return TurnContract(
        intent=intent,
        domain=domain,
        required_tool=tool,
        required_blocks=required_blocks or (("resumo",) if intent == "actions" else ()),
        metrics=tuple(metrics),
        period=tool_period,
        filters=filters,
        funnel_mode=funnel_mode,
        presentation=presentation,
        resolution_status="resolved" if tool else "clarify",
    )


def _default_sales_metrics(intent: str) -> list[str]:
    if intent in {"loss_diagnosis", "loss_details"}:
        return ["vendas.valor_perdido", "vendas.negocios_perdidos"]
    if intent == "sales_comparison":
        return ["vendas.faturamento", "vendas.pedidos_aprovados", "vendas.ticket_medio", "vendas.valor_perdido", "vendas.negocios_perdidos"]
    return ["vendas.faturamento", "vendas.pedidos_aprovados", "vendas.ticket_medio"]


def _default_comparison_metrics(domain: str) -> list[str]:
    if domain == "acoes":
        return ["acoes.visitas", "acoes.oportunidades", "acoes.ganhos", "acoes.perdidos"]
    if domain == "equipe":
        return ["equipe.vendas", "equipe.faturamento", "equipe.ticket_medio", "equipe.conversao"]
    return _default_sales_metrics("sales_comparison")


def _metrics(value: Any, intent: str, domain: str) -> list[str]:
    if not isinstance(value, list):
        return []
    allowed_prefix = {"vendas", "acoes", "equipe"}
    result = []
    for item in value[:6]:
        normalized = str(item).strip()[:120]
        if normalized and normalized.split(".", 1)[0] in allowed_prefix and normalized not in result:
            result.append(normalized)
    return result


def _safe_filters(request: YaChatRequest, raw: dict[str, Any]) -> dict[str, Any]:
    values = request.context.filters.model_dump(by_alias=True, exclude_none=True)
    classifier_filters = raw.get("filters")
    if isinstance(classifier_filters, dict):
        for key in ("vendedor", "cidade", "produto", "condicao", "origem", "banco", "motivo_perda"):
            value = classifier_filters.get(key)
            if isinstance(value, str) and value.strip():
                values[key] = value.strip()[:120]
    return {key: value for key, value in values.items() if value not in (None, "", []) and key not in {"categoria", "from", "to", "funil", "funis"}}


def _intent(value: Any) -> str:
    normalized = str(value or "").strip().casefold()
    aliases = {
        "sales": "sales_summary", "vendas": "sales_summary", "comparison": "sales_comparison",
        "compare": "sales_comparison", "losses": "loss_diagnosis", "perdas": "loss_diagnosis",
        "greeting": "casual", "conversa": "casual", "unknown": "clarify",
    }
    return aliases.get(normalized, normalized if normalized in {"casual", "sales_summary", "sales_comparison", "loss_diagnosis", "loss_details", "actions", "team", "correlation", "concept", "freshness", "memory", "exploration", "clarify"} else "clarify")


def _semantic_intent_override(intent: str, message: str) -> str:
    """Correct only unmistakable high-risk verbs before selecting evidence."""
    if any(fragment in message for fragment in ("comparad", "comparar", "versus", " x ", "diferença entre", "diferenca entre")):
        return "sales_comparison"
    if "produt" in message and any(fragment in message for fragment in ("diferença", "diferenca", "explicam")):
        return "sales_comparison"
    if any(fragment in message for fragment in ("perdas", "percas", "negócios perdidos", "negocios perdidos")):
        if any(fragment in message for fragment in ("detalh", "mais sobre", "motivo", "vendedor", "cidade", "produto")):
            return "loss_details"
        if any(fragment in message for fragment in ("diagnóst", "diagnost", "por que", "por quê", "porque")):
            return "loss_diagnosis"
    return intent


def _needs_product_drilldown(message: str) -> bool:
    return "produt" in message and any(fragment in message for fragment in ("diferença", "diferenca", "explicam", "varia"))


def _action_blocks(message: str, raw: dict[str, Any]) -> tuple[str, ...]:
    requested = raw.get("blocos") if isinstance(raw.get("blocos"), list) else []
    blocks = [item for item in requested if item in {"resumo", "visitas", "funil", "ranking", "evolucao", "ganhos", "perdas", "detalhes"}]
    if any(fragment in message for fragment in ("por vendedor", "por consultor", "ranking")):
        blocks.append("ranking")
    return tuple(dict.fromkeys(blocks))


def _memory_tool(message: str) -> str | None:
    if any(fragment in message for fragment in ("esqueç", "esquec", "apague", "apagar", "remova", "remover")):
        return "esquecer_memoria_usuario"
    if any(fragment in message for fragment in ("lembre", "lembrar", "guarde", "guardar", "salve", "salvar", "memorize")):
        return "guardar_memoria_usuario"
    return None


def _funnel_mode(request: YaChatRequest, raw: dict[str, Any], message: str) -> str:
    if any(fragment in message for fragment in ("somente repasse", "apenas repasse", "só repasse", "so repasse")):
        return "somente_repasse"
    if any(fragment in message for fragment in ("inclua repasse", "incluir repasse", "todos os funis", "todos funis")):
        return "todos"
    candidate = str(raw.get("funnel_mode") or "padrao")
    if candidate in {"todos", "somente_repasse", "selecionados"}:
        return candidate
    screen_funnel = " ".join(str(value) for value in (request.context.filters.funil, *request.context.filters.funis) if value)
    return "somente_repasse" if "repasse" in screen_funnel.casefold() else "padrao"


def _domain(value: Any, intent: str) -> str:
    normalized = str(value or "").strip().casefold()
    if normalized in {"vendas", "acoes", "equipe"}:
        return normalized
    if intent in {"sales_summary", "sales_comparison", "loss_diagnosis", "loss_details"}:
        return "vendas"
    return "conversation"


def _comparison_scope(value: Any, message: str) -> str:
    normalized = str(value or "").strip().casefold()
    if "agosto inteiro" in message or "mês passado inteiro" in message or "mes passado inteiro" in message:
        return "full_previous"
    if any(fragment in message for fragment in ("mesmos dias", "mesmo período", "mesmo periodo", "primeiros dias")):
        return "same_elapsed"
    if any(fragment in message for fragment in ("até agora", "ate agora", "até o momento", "ate o momento")) and mentions_previous(message):
        return "ask"
    if normalized in {"full_previous", "same_elapsed", "ask"}:
        return normalized
    return "ask"


def _compatibility_contract() -> TurnContract:
    return TurnContract(intent="compatibility", classifier_status="not_injected")


def _usage_int(usage: Any, *keys: str) -> int:
    if not isinstance(usage, dict):
        return 0
    for key in keys:
        try:
            return max(0, int(usage.get(key) or 0))
        except (TypeError, ValueError) as error:
            log_event(logging.DEBUG, "ai_agent_intent_usage_invalid", error_type=type(error).__name__)
    return 0
