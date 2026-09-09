"""Server-authoritative calendar and comparison scopes for agent turns."""

from __future__ import annotations

from datetime import date, timedelta
import logging
from typing import Any

from ai_logger import log_event


def resolve_period(
    period_request: str,
    today: date,
    state: dict[str, Any],
    sources: list[Any],
    message: str,
    scope: str,
    start_value: Any = None,
    end_value: Any = None,
    topic: str | None = None,
) -> dict[str, str]:
    if period_request == "explicit":
        period = _parse_period(start_value, end_value, today=today, clamp_to_today=True)
        if period:
            return period
    if period_request == "inherit" or _is_followup(message):
        inherited = inherited_period(state, sources, topic)
        if inherited:
            return inherited
    if period_request == "previous_full" or mentions_previous(message):
        return month_period(shift_month(today, -1))
    if period_request == "previous_to_date":
        return same_elapsed_period(today, -1)
    if period_request == "same_elapsed" or scope == "same_elapsed":
        return month_period(today, to_date=True)
    if period_request == "current_full":
        return month_period(today, to_date=False)
    return month_period(today, to_date=True)


def resolve_comparison(
    period_request: str,
    scope: str,
    today: date,
    raw: dict[str, Any] | None = None,
) -> dict[str, Any]:
    raw = raw or {}
    explicit_current = _parse_period(
        raw.get("current_period_start"), raw.get("current_period_end"), today=today, clamp_to_today=True
    )
    explicit_base = _parse_period(
        raw.get("base_period_start"), raw.get("base_period_end"), today=today, clamp_to_today=False
    )
    # When scope is same_elapsed, enforce same elapsed days so that an in-progress month
    # (e.g. Sep 01-09) is never compared against a full 31-day month as its primary baseline.
    if scope == "same_elapsed" or (scope != "full_previous" and period_request in {"same_elapsed", "previous_to_date", "current_to_date"}):
        current = explicit_current or month_period(today, to_date=True)
        curr_start = date.fromisoformat(current["from"])
        curr_end = date.fromisoformat(current["to"])
        elapsed_days = (curr_end - curr_start).days
        target = shift_month(curr_start, -1)
        base_start = target.replace(day=1)
        base_end = min(base_start + timedelta(days=elapsed_days), shift_month(base_start, 1) - timedelta(days=1))
        return {
            "atual": current,
            "base": {"from": base_start.isoformat(), "to": base_end.isoformat()},
            "scope": "same_elapsed",
        }

    if explicit_current and explicit_base:
        return {"atual": explicit_current, "base": explicit_base, "scope": "explicit"}

    current = explicit_current or month_period(today, to_date=period_request != "current_full")
    if scope == "full_previous" or period_request == "previous_full":
        base = month_period(shift_month(today, -1))
        scope_label = "full_previous"
    else:
        base = same_elapsed_period(today, -1)
        scope_label = "same_elapsed"
    return {"atual": current, "base": base, "scope": scope_label}


def inherited_period(state: dict[str, Any], sources: list[Any], topic: str | None = None) -> dict[str, str] | None:
    topics = state.get("topics") if isinstance(state, dict) else None
    if isinstance(topics, dict):
        preferred = [topic, str(state.get("active_topic") or ""), "vendas", "acoes", "equipe"]
        for key in dict.fromkeys(value for value in preferred if value):
            candidate = topics.get(key)
            if isinstance(candidate, dict) and isinstance(candidate.get("period"), dict):
                period = candidate["period"]
                if period.get("from") and period.get("to"):
                    return {"from": str(period["from"]), "to": str(period["to"])}
    for source in sources:
        applied = source.applied_scope if isinstance(source.applied_scope, dict) else {}
        period = applied.get("period")
        if isinstance(period, dict) and period.get("from") and period.get("to"):
            return {"from": str(period["from"]), "to": str(period["to"])}
        comparison = applied.get("comparacao")
        if isinstance(comparison, dict) and isinstance(comparison.get("atual"), dict):
            current = comparison["atual"]
            if current.get("from") and current.get("to"):
                return {"from": str(current["from"]), "to": str(current["to"])}
    return None


def month_period(value: date, *, to_date: bool = False) -> dict[str, str]:
    start = value.replace(day=1)
    if to_date:
        end = value
    else:
        end = shift_month(start, 1) - timedelta(days=1)
    return {"from": start.isoformat(), "to": end.isoformat()}


def same_elapsed_period(today: date, month_offset: int) -> dict[str, str]:
    target = shift_month(today, month_offset)
    start = target.replace(day=1)
    end = min(start + timedelta(days=today.day - 1), shift_month(start, 1) - timedelta(days=1))
    return {"from": start.isoformat(), "to": end.isoformat()}


def shift_month(value: date, offset: int) -> date:
    index = value.year * 12 + value.month - 1 + offset
    year, month_index = divmod(index, 12)
    return date(year, month_index + 1, min(value.day, 28))


def comparison_choices(today: date) -> list[dict[str, str]]:
    month_name = month_name_for(shift_month(today, -1).month)
    return [
        {"label": f"{month_name} inteiro", "value": f"Compare com {month_name.lower()} inteiro."},
        {"label": f"Mesmos {today.day} dias", "value": f"Compare os mesmos {today.day} primeiros dias de {month_name.lower()}."},
    ]


def month_name_for(month: int) -> str:
    return ("Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro")[month - 1]


def _parse_period(start_value: Any, end_value: Any, *, today: date, clamp_to_today: bool) -> dict[str, str] | None:
    try:
        start, end = date.fromisoformat(str(start_value)), date.fromisoformat(str(end_value))
        if start > end:
            raise ValueError("período invertido")
        if clamp_to_today and start > today:
            raise ValueError("período futuro")
        return {"from": start.isoformat(), "to": min(end, today).isoformat() if clamp_to_today else end.isoformat()}
    except (TypeError, ValueError) as error:
        log_event(logging.DEBUG, "ai_agent_explicit_period_invalid", error_type=type(error).__name__)
        return None


def mentions_previous(message: str) -> bool:
    return any(fragment in message for fragment in ("mês passado", "mes passado", "mês anterior", "mes anterior", "último mês", "ultimo mes", "agosto"))


def _is_followup(message: str) -> bool:
    if any(fragment in message for fragment in ("essas perdas", "essas percas", "mais sobre as perdas", "mais sobre as percas", "detalhes das perdas", "detalhes das percas", "diagnóstico dessas perdas", "diagnóstico dessas percas", "diagnostico dessas perdas", "diagnostico dessas percas")):
        return True
    return any(word in message for word in ("perdas", "percas")) and any(marker in message for marker in ("diagnóst", "diagnost", "detalh", "mais sobre"))
