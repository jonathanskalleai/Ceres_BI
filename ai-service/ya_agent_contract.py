"""Server-owned evidence contracts used by the v2 model loop."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

from ya_agent_models import ToolExecution
from ya_models import YaSource


CLASSIFIER_VERSION = "ya-intent-v1"


@dataclass(frozen=True)
class TurnContract:
    """Evidence and tool requirements for one user turn."""

    intent: str
    domain: str = "conversation"
    required_tool: str | None = None
    required_tools: tuple[str, ...] = ()
    required_blocks: tuple[str, ...] = ()
    metrics: tuple[str, ...] = ()
    period: dict[str, str] | None = None
    comparison: dict[str, Any] | None = None
    filters: dict[str, Any] = field(default_factory=dict)
    funnel_mode: str = "padrao"
    presentation: str = "texto"
    choices: tuple[dict[str, str], ...] = ()
    clarification_text: str = ""
    resolution_status: str = "resolved"
    classifier_status: str = "model"

    @property
    def requires_evidence(self) -> bool:
        return bool(self.tool_names)

    @property
    def tool_names(self) -> tuple[str, ...]:
        names = self.required_tools or ((self.required_tool,) if self.required_tool else ())
        return tuple(dict.fromkeys(name for name in names if name))

    def next_required_tool(self, executions: list[ToolExecution]) -> str | None:
        successful = {item.tool_name for item in executions if item.status == "ok"}
        return next((name for name in self.tool_names if name not in successful), None)

    def tool_choice(self, tool_name: str | None = None) -> Any:
        required = tool_name or self.required_tool
        if not required:
            return "none" if self.intent in {"casual", "clarify"} else "auto"
        return {"type": "function", "function": {"name": required}}

    def prompt_payload(self) -> dict[str, Any]:
        return {
            "intent": self.intent,
            "domain": self.domain,
            "required_tool": self.required_tool,
            "required_tools": list(self.tool_names),
            "required_blocks": list(self.required_blocks),
            "metrics": list(self.metrics),
            "period": self.period,
            "comparison": self.comparison,
            "filters": self.filters,
            "funnel_mode": self.funnel_mode,
            "presentation": self.presentation,
            "choices": list(self.choices),
            "clarification_text": self.clarification_text,
            "resolution_status": self.resolution_status,
        }

    def query_spec(self) -> dict[str, Any]:
        payload = self.prompt_payload()
        payload.update({"contract_version": CLASSIFIER_VERSION, "choices": list(self.choices), "classifier_status": self.classifier_status})
        return payload

    def tool_arguments(self, name: str, arguments: Any) -> dict[str, Any]:
        """Patch dates, blocks and filters with server-authoritative values."""
        candidate = dict(arguments) if isinstance(arguments, dict) else {}
        if name == "guardar_memoria_usuario" and self.intent == "memory":
            output = dict(candidate)
            # The classifier only creates this contract for an explicit user
            # request to remember something; the model must not downgrade that
            # request to a silent confirmation prompt.
            output["confirmado"] = True
            return output
        if name == "consultar_desempenho_vendas" and self.domain == "vendas":
            output = dict(candidate)
            if self.period:
                output["periodo_inicio"] = self.period["from"]
                output["periodo_fim"] = self.period["to"]
            requested_blocks = candidate.get("blocos") if isinstance(candidate.get("blocos"), list) else []
            allowed_blocks = {"kpis", "serie", "rankings", "perdas", "produtos", "resumo"}
            extra_blocks = () if self.intent in {"loss_diagnosis", "loss_details"} else tuple(item for item in requested_blocks if item in allowed_blocks)
            output["blocos"] = list(dict.fromkeys([*self.required_blocks, *extra_blocks]))[:6] or ["kpis"]
            output["apresentacao"] = self.presentation if self.presentation != "texto" else "tabela"
            output["modo_funil"] = self.funnel_mode
            output["filtros"] = _merge_filters(self.filters, candidate.get("filtros"))
            return output
        if name == "comparar_periodos" and self.comparison:
            output = dict(candidate)
            output.update({
                "dominio": self.domain,
                "metricas": list(self.metrics),
                "periodo_atual_inicio": self.comparison["atual"]["from"],
                "periodo_atual_fim": self.comparison["atual"]["to"],
                "periodo_base_inicio": self.comparison["base"]["from"],
                "periodo_base_fim": self.comparison["base"]["to"],
                "modo_funil": self.funnel_mode,
                "filtros": _merge_filters(self.filters, candidate.get("filtros")),
                "apresentacao": self.presentation if self.presentation != "texto" else "tabela",
            })
            return output
        if name == "consultar_acoes_comerciais" and self.period:
            output = dict(candidate)
            output.update({
                "periodo_inicio": self.period["from"],
                "periodo_fim": self.period["to"],
                "filtros": _merge_filters(self.filters, candidate.get("filtros")),
                "apresentacao": self.presentation if self.presentation != "texto" else "tabela",
            })
            allowed_blocks = {"resumo", "visitas", "funil", "ranking", "evolucao", "ganhos", "perdas", "detalhes"}
            candidate_blocks = candidate.get("blocos") if isinstance(candidate.get("blocos"), list) else []
            output["blocos"] = list(dict.fromkeys([*self.required_blocks, *(item for item in candidate_blocks if item in allowed_blocks)]))[:8] or ["resumo"]
            return output
        if name == "correlacionar_metricas" and self.period:
            output = dict(candidate)
            output.update({
                "periodo_inicio": self.period["from"],
                "periodo_fim": self.period["to"],
                "filtros": _merge_filters(self.filters, candidate.get("filtros")),
            })
            if len(self.metrics) >= 2:
                output["metrica_a"], output["metrica_b"] = self.metrics[:2]
            return output
        if name == "explicar_conceito" and self.metrics:
            output = dict(candidate)
            output["metrica"] = self.metrics[0]
            return output
        if name == "consultar_desempenho_equipe" and self.period:
            output = dict(candidate)
            start = date.fromisoformat(self.period["from"])
            end = date.fromisoformat(self.period["to"])
            output["ano"] = start.year
            output["meses"] = list(range(start.month, end.month + 1)) if start.year == end.year else []
            output["consultor"] = self.filters.get("vendedor", candidate.get("consultor"))
            output["cidade"] = self.filters.get("cidade", candidate.get("cidade"))
            return output
        return candidate


@dataclass(frozen=True)
class ContractResolution:
    contract: TurnContract
    raw: dict[str, Any] = field(default_factory=dict)
    classifier_input_tokens: int = 0
    classifier_output_tokens: int = 0


def contract_evidence_status(contract: TurnContract, executions: list[ToolExecution], sources: list[YaSource]) -> tuple[bool, str]:
    """Check the semantic postcondition before allowing model prose to pass."""
    if not contract.requires_evidence:
        return True, "not_required"
    successful = [item for item in executions if item.status == "ok"]
    missing_tools = [name for name in contract.tool_names if not any(item.tool_name == name for item in successful)]
    if missing_tools:
        return False, "required_tool_missing"
    for name in contract.tool_names:
        if name == "comparar_periodos":
            if not any(isinstance(item.data, dict) and item.data.get("comparacoes") for item in successful if item.tool_name == name):
                return False, "comparison_data_missing"
            expected = contract.comparison or {}
            if not any(
                isinstance(source.applied_scope, dict)
                and isinstance(source.applied_scope.get("comparacao"), dict)
                and _comparison_matches(source.applied_scope["comparacao"], expected)
                for source in sources
            ):
                return False, "comparison_scope_missing"
            continue
        if name == "consultar_desempenho_vendas" and not _sales_postcondition(contract, successful, sources):
            return False, "required_blocks_or_scope_missing"
    return True, "passed"


def _sales_postcondition(contract: TurnContract, executions: list[ToolExecution], sources: list[YaSource]) -> bool:
    required = set(contract.required_blocks)
    for execution in executions:
        if execution.tool_name != "consultar_desempenho_vendas":
            continue
        data = execution.data if isinstance(execution.data, dict) else {}
        if "perdas" in required and not isinstance(data.get("perdas"), dict):
            continue
        if "perdas" in required and contract.intent in {"loss_diagnosis", "loss_details"}:
            losses = data.get("perdas") or {}
            if not any(isinstance(losses.get(key), list) and losses.get(key) for key in ("motivos", "vendedores", "cidades", "produtos", "origens")):
                continue
        if all(_block_present(data, block) for block in required) and _period_in_sources(contract.period, sources, contract.domain):
            return True
    return False


def _block_present(data: dict[str, Any], block: str) -> bool:
    if block == "kpis":
        return isinstance(data.get("kpis"), dict)
    if block == "rankings":
        return isinstance(data.get("rankings"), dict) or isinstance((data.get("perdas") or {}).get("vendedores"), list)
    if block == "produtos":
        return (
            isinstance(data.get("produtos"), list)
            or isinstance((data.get("perdas") or {}).get("produtos"), list)
            or isinstance((data.get("rankings") or {}).get("produtos"), list)
        )
    if block == "resumo":
        return isinstance(data.get("kpis"), dict) and bool(data.get("kpis"))
    return block in data


def _period_in_sources(period: dict[str, str] | None, sources: list[YaSource], domain: str = "") -> bool:
    if not period:
        return bool(sources)
    for source in sources:
        candidate = source.applied_scope.get("period") if isinstance(source.applied_scope, dict) else None
        if not isinstance(candidate, dict):
            continue
        if candidate.get("from") == period.get("from") and candidate.get("to") == period.get("to"):
            return True
        if domain == "equipe" and candidate.get("from") <= period.get("from", "") and candidate.get("to") >= period.get("to", ""):
            return True
    return False


def _comparison_matches(actual: dict[str, Any], expected: dict[str, Any]) -> bool:
    return all(
        isinstance(actual.get(key), dict)
        and isinstance(expected.get(key), dict)
        and actual[key].get("from") == expected[key].get("from")
        and actual[key].get("to") == expected[key].get("to")
        for key in ("atual", "base")
    )


def _merge_filters(contract_filters: dict[str, Any], candidate: Any) -> dict[str, Any]:
    output = dict(contract_filters)
    if isinstance(candidate, dict):
        for key in ("vendedor", "cidade", "produto", "condicao", "origem", "banco", "motivo_perda"):
            value = candidate.get(key)
            if isinstance(value, str) and value.strip():
                output[key] = value.strip()[:120]
    return output
