"""Normalizers shared by the official tool implementations."""

from __future__ import annotations

import logging
from typing import Any

from ai_logger import log_event
from ya_agent_tools.common import first_number


def team_rows(value: Any, months: list[int]) -> list[dict[str, Any]]:
    rows = [dict(item) for item in (value if isinstance(value, list) else []) if isinstance(item, dict)]
    if months:
        rows = [row for row in rows if month_from_row(row) in months]
    for row in rows:
        quantity = first_number(row, "quantidade_vendas", "quantidadeVendas", "vendas", "qtd_vendas", "qtdVendas")
        revenue = first_number(row, "faturamento", "valor_vendido", "valorVendido", "valor")
        ticket = first_number(row, "ticket_medio", "ticketMedio")
        businesses = first_number(row, "negocios", "negócios")
        conversion = first_number(row, "taxa_conversao_negocios", "taxaConversaoNegocios", "conversao", "conversão")
        if ticket is None and quantity not in (None, 0) and revenue is not None:
            row["ticket_medio"] = round(float(revenue) / float(quantity), 2)
        if conversion is None and businesses not in (None, 0) and quantity is not None:
            row["taxa_conversao_negocios"] = round(float(quantity) * 100 / float(businesses), 1)
    return rows[:100]


def month_from_row(row: dict[str, Any]) -> int | None:
    value = row.get("competencia") or row.get("mes") or row.get("month") or row.get("data")
    if hasattr(value, "month"):
        return value.month
    if isinstance(value, str):
        try:
            return int(value[5:7]) if len(value) >= 7 and value[4] == "-" else int(value)
        except ValueError as error:
            log_event(logging.DEBUG, "ai_agent_team_month_invalid", error_type=type(error).__name__)
    return None


def drop_unselected(row: dict[str, Any], selected: set[str]) -> None:
    keep = {"consultor", "cidade", "competencia", "mes", "data", "vendas", "quantidade_vendas"}
    mapping = {"faturamento": "faturamento", "ticket_medio": "ticket_medio", "meta": "meta", "conversao": "taxa_conversao_negocios", "negocios": "negocios", "oportunidades_abertas": "oportunidades_abertas"}
    for indicator, key in mapping.items():
        if indicator not in selected and key not in keep:
            row.pop(key, None)


def team_totals(rows: list[dict[str, Any]]) -> dict[str, Any]:
    totals: dict[str, float] = {}
    for row in rows:
        for key in ("quantidade_vendas", "vendas", "faturamento", "meta", "negocios", "oportunidades_abertas"):
            number = first_number(row, key)
            if number is not None:
                totals[key] = round(totals.get(key, 0) + float(number), 2)
    if totals.get("quantidade_vendas") and totals.get("faturamento") is not None:
        totals["ticket_medio"] = round(totals["faturamento"] / totals["quantidade_vendas"], 2)
    if totals.get("negocios"):
        totals["taxa_conversao_negocios"] = round(totals.get("quantidade_vendas", 0) * 100 / totals["negocios"], 1)
    return totals


def count_nested_rows(value: Any) -> int:
    if isinstance(value, list):
        return len(value)
    if isinstance(value, dict):
        return sum(count_nested_rows(item) for item in value.values())
    return 0
