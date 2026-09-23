"""Server-side composition for the main BI panel.

The browser used to join current/previous responses and derive trends and
ticket médio.  This module keeps that semantic contract in the API so every
client receives the same KPI result and an explicit data-quality signal.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

Trend = str


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _nested(value: Any, *keys: str) -> Any:
    current = value
    for key in keys:
        if not isinstance(current, Mapping) or key not in current:
            return None
        current = current[key]
    return current


def _number(value: Any) -> float | int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return value
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _trend(current: float, previous: float, *, inverted: bool = False) -> Trend:
    if current == previous:
        return "neutral"
    higher_is_up = current > previous
    if inverted:
        higher_is_up = not higher_is_up
    return "up" if higher_is_up else "down"


def _kpi(
    current: Any,
    previous: Any,
    missing: list[str],
    name: str,
    *,
    inverted: bool = False,
) -> dict[str, Any]:
    current_number = _number(current)
    previous_number = _number(previous)
    current_missing = current_number is None
    previous_missing = previous_number is None
    if current_missing:
        missing.append(f"current.{name}")
    if previous_missing:
        missing.append(f"previous.{name}")
    current_value = current_number if current_number is not None else 0
    previous_value = previous_number if previous_number is not None else 0
    return {
        "value": current_value,
        "previousValue": previous_value,
        "trend": _trend(current_value, previous_value, inverted=inverted),
        "valueStatus": "missing" if current_missing else "ready",
        "previousValueStatus": "missing" if previous_missing else "ready",
    }


def _field(record: Any, path: tuple[str, ...], missing: list[str], name: str) -> float | int:
    value = _number(_nested(record, *path))
    if value is None:
        missing.append(name)
        return 0
    return value


def _array_items(record: Any, path: tuple[str, ...]) -> list[Mapping[str, Any]]:
    value = _nested(record, *path)
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, Mapping)]


def compose_panel_kpis(
    current_negocios: Any,
    previous_negocios: Any,
    current_acoes: Any,
    previous_acoes: Any,
    current_funil: Any,
    previous_funil: Any,
    current_operacional: Any,
) -> tuple[dict[str, Any], list[str]]:
    """Compose the panel contract without business calculations in React."""

    missing: list[str] = []
    neg_current = _mapping(current_negocios)
    neg_previous = _mapping(previous_negocios)
    ac_current = _mapping(current_acoes)
    ac_previous = _mapping(previous_acoes)
    fun_current = _mapping(current_funil)
    fun_previous = _mapping(previous_funil)
    op_current = _mapping(current_operacional)

    neg_current_kpis = _mapping(neg_current.get("kpis"))
    neg_previous_kpis = _mapping(neg_previous.get("kpis"))
    ac_current_kpis = _mapping(ac_current.get("kpis"))
    ac_previous_kpis = _mapping(ac_previous.get("kpis"))
    fun_current_data = _mapping(fun_current.get("funil"))
    fun_previous_data = _mapping(fun_previous.get("funil"))
    fun_current_stalled = _mapping(fun_current.get("diasParados"))
    fun_previous_stalled = _mapping(fun_previous.get("diasParados"))
    op_current_kpis = _mapping(op_current.get("kpis"))

    def pair(key: str, *, inverted: bool = False) -> dict[str, Any]:
        return _kpi(
            neg_current_kpis.get(key),
            neg_previous_kpis.get(key),
            missing,
            key,
            inverted=inverted,
        )

    def action_pair(key: str, *, inverted: bool = False) -> dict[str, Any]:
        return _kpi(
            ac_current_kpis.get(key),
            ac_previous_kpis.get(key),
            missing,
            f"acoes.{key}",
            inverted=inverted,
        )

    def funnel_pair(key: str, *, inverted: bool = False) -> dict[str, Any]:
        return _kpi(
            fun_current_data.get(key),
            fun_previous_data.get(key),
            missing,
            f"funil.{key}",
            inverted=inverted,
        )

    current_gain_count = _field(ac_current_kpis, ("negociosGanho",), missing, "acoes.negociosGanho")
    previous_gain_count = _field(ac_previous_kpis, ("negociosGanho",), missing, "previous.acoes.negociosGanho")
    current_gain_value = _field(ac_current_kpis, ("valorGanho",), missing, "acoes.valorGanho")
    previous_gain_value = _field(ac_previous_kpis, ("valorGanho",), missing, "previous.acoes.valorGanho")

    current_ticket = current_gain_value / current_gain_count if current_gain_count else 0
    previous_ticket = previous_gain_value / previous_gain_count if previous_gain_count else 0

    current_actions = _field(ac_current_kpis, ("totalAcoes",), missing, "acoes.totalAcoes")
    previous_actions = _field(ac_previous_kpis, ("totalAcoes",), missing, "previous.acoes.totalAcoes")
    current_visits = _field(ac_current_kpis, ("visitas",), missing, "acoes.visitas")
    previous_visits = _field(ac_previous_kpis, ("visitas",), missing, "previous.acoes.visitas")
    current_other = _field(ac_current_kpis, ("negociosOutrosStatus",), missing, "acoes.negociosOutrosStatus")

    current_stalled = _number(fun_current_stalled.get("mediana"))
    previous_stalled = _number(fun_previous_stalled.get("mediana"))
    if current_stalled is None:
        missing.append("funil.diasParados.mediana")
        current_stalled = 0
    if previous_stalled is None:
        missing.append("previous.funil.diasParados.mediana")
        previous_stalled = 0

    current_type = {str(item.get("name")): _number(item.get("value")) or 0 for item in _array_items(ac_current, ("porTipoAcao",))}
    previous_type = {str(item.get("name")): _number(item.get("value")) or 0 for item in _array_items(ac_previous, ("porTipoAcao",))}
    por_tipo = [
        {
            "name": name,
            "value": value,
            "previousValue": previous_type.get(name, 0),
            "trend": _trend(value, previous_type.get(name, 0)),
        }
        for name, value in current_type.items()
    ]

    data = {
        "totalNegocios": pair("totalNegocios"),
        "ganhos": action_pair("negociosGanho"),
        "perdidos": action_pair("negociosPerdido"),
        "andamento": pair("andamento"),
        "taxaConversao": pair("taxaConversao"),
        "valorGanho": action_pair("valorGanho"),
        "valorPerdido": action_pair("valorPerdido"),
        "pipelineAberto": funnel_pair("valorOportunidades"),
        "ticketMedio": _kpi(current_ticket, previous_ticket, missing, "ticketMedio"),
        "totalAcoes": _kpi(current_actions, previous_actions, missing, "acoes.totalAcoes"),
        "totalVisitas": _kpi(current_visits, previous_visits, missing, "acoes.visitas"),
        "totalOS": _kpi(op_current_kpis.get("eventosAgenda"), 0, missing, "operacional.eventosAgenda"),
        "porTipoAcao": por_tipo,
        "oportunidadesAbertas": funnel_pair("oportunidades"),
        "visitasPorOportunidade": funnel_pair("visitasPorOportunidade"),
        "diasParados": _kpi(current_stalled, previous_stalled, missing, "funil.diasParados", inverted=True),
        "negociosOutrosStatus": current_other,
        "ignoresFunilFilter": {
            "ganhos": True,
            "perdidos": True,
            "valorGanho": True,
            "valorPerdido": True,
            "totalAcoes": True,
            "totalVisitas": True,
            "ticketMedio": True,
            "totalOS": True,
            "negociosOutrosStatus": True,
        },
        "dataQuality": {
            "status": "partial" if missing else "ready",
            "missing": sorted(set(missing)),
        },
    }
    return data, sorted(set(missing))
