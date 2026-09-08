"""Calendar and comparison rules for conversational BI queries."""

from __future__ import annotations

import re
import unicodedata
from datetime import date, timedelta
from typing import Any

from ya_query_models import ComparisonSpec, PeriodSpec


class QueryValidationError(ValueError):
    """Raised when a proposed plan cannot be represented by the catalog."""


def _normalize_period_text(value: Any) -> str:
    raw = " ".join(str(value or "").split()).casefold()
    return "".join(
        char for char in unicodedata.normalize("NFD", raw)
        if unicodedata.category(char) != "Mn"
    )


def _parse_date(value: Any) -> date | None:
    if isinstance(value, date):
        return value
    if not isinstance(value, str):
        return None
    try:
        parsed = date.fromisoformat(value[:10])
    except ValueError:
        return None
    if parsed.year < 2020 or parsed > date.today():
        return None
    return parsed


def _month_start(day: date) -> date:
    return day.replace(day=1)


def _natural_period(message: str, today: date) -> tuple[date, date] | None:
    text = _normalize_period_text(message)
    days_match = re.search(r"ultimos?\s+(\d{1,3})\s+dias", text)
    if days_match:
        days = min(max(int(days_match.group(1)), 1), 366)
        return today - timedelta(days=days - 1), today
    comparative = any(term in text for term in ("compare", "comparar", "versus", " contra "))
    if not comparative and any(term in text for term in ("mes passado", "mes anterior", "ultimo mes")):
        current_month_start = _month_start(today)
        previous_month_end = current_month_start - timedelta(days=1)
        return _month_start(previous_month_end), previous_month_end
    if not comparative and any(term in text for term in ("ano passado", "ano anterior")):
        return date(today.year - 1, 1, 1), date(today.year - 1, 12, 31)
    if any(term in text for term in ("este ano", "ano atual")):
        return date(today.year, 1, 1), today
    return None


def _period_from(
    context_filters: dict[str, Any],
    memory_state: dict[str, Any],
    planned: dict[str, Any],
    message: str,
) -> PeriodSpec:
    planned_period = planned.get("period") if isinstance(planned.get("period"), dict) else planned
    previous_spec = memory_state.get("last_query_spec") if isinstance(memory_state, dict) else {}
    previous_period = previous_spec.get("period") if isinstance(previous_spec, dict) else {}

    def period_value(period_data: Any, alias: str) -> Any:
        if not isinstance(period_data, dict):
            return None
        return period_data.get(alias) or period_data.get(f"{alias}_date")

    today = date.today()
    natural = _natural_period(message, today)
    from_date = (
        _parse_date(period_value(planned_period, "from"))
        or (natural[0] if natural else None)
        or _parse_date(context_filters.get("from"))
        or _parse_date(period_value(previous_period, "from"))
        or _month_start(today)
    )
    to_date = (
        _parse_date(period_value(planned_period, "to"))
        or (natural[1] if natural else None)
        or _parse_date(context_filters.get("to"))
        or _parse_date(period_value(previous_period, "to"))
        or today
    )
    if from_date > to_date:
        raise QueryValidationError("O início do período precisa ser anterior ao fim.")
    return PeriodSpec.model_validate({"from": from_date, "to": to_date})


def previous_period(period: PeriodSpec) -> PeriodSpec:
    length = (period.to_date - period.from_date).days + 1
    baseline_to = period.from_date - timedelta(days=1)
    return PeriodSpec.model_validate({
        "from": baseline_to - timedelta(days=length - 1),
        "to": baseline_to,
        "timezone": period.timezone,
    })


def previous_year_period(period: PeriodSpec) -> PeriodSpec:
    def shift(day: date) -> date:
        try:
            return day.replace(year=day.year - 1)
        except ValueError:
            return day.replace(year=day.year - 1, day=28)

    return PeriodSpec.model_validate({
        "from": shift(period.from_date),
        "to": shift(period.to_date),
        "timezone": period.timezone,
    })


def comparison_for(message: str, period: PeriodSpec) -> ComparisonSpec:
    text = _normalize_period_text(message)
    same_year_terms = ("mesmo periodo do ano passado", "mesmo periodo ano passado", "ano passado", "ano anterior")
    if any(term in text for term in same_year_terms):
        return ComparisonSpec(
            kind="same_period_previous_year",
            baseline=previous_year_period(period),
            label="mesmo período do ano anterior",
        )
    return ComparisonSpec(baseline=previous_period(period))
