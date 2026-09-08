"""Bounded natural-language filter extraction for semantic planning."""

from __future__ import annotations

import re


def safe_filter(value: object, max_length: int = 120) -> str | None:
    if not isinstance(value, str):
        return None
    clean = " ".join(value.split())[:max_length]
    return clean or None


def question_filters(message: str, domain: str) -> dict[str, str]:
    """Extract only explicit, bounded filter phrases from the user question."""
    if domain not in {"vendas", "negocios", "acoes", "pedidos", "servicos"}:
        return {}
    filters: dict[str, str] = {}
    named = re.search(
        r"\b(?:vendedor|consultor)\s+(?:é\s+|e\s+|:\s*)?([A-ZÀ-Ý][\wÀ-ÿ .&'-]{1,100}?)(?=\s+(?:com|no|na|em|para|e|do|da|de)\b|[?.!,]|$)",
        message,
    )
    implicit = re.search(
        r"\bpara\s+(?:o|a)\s+([A-ZÀ-Ý][\wÀ-ÿ .&'-]{1,80}?)(?=\s+(?:com|no|na|em|para|e|do|da|de)\b|[?.!,]|$)",
        message,
    )
    candidate = named.group(1) if named else implicit.group(1) if implicit else None
    if candidate:
        value = safe_filter(candidate.rstrip("?.!,"))
        if value:
            filters["vendedor"] = value
    city = re.search(
        r"\b(?:em|na|no)\s+(?:cidade\s+de\s+)?([A-ZÀ-Ý][\wÀ-ÿ .'-]{1,100}?)(?=\s+(?:com|para|e|do|da|de)\b|[?.!,]|$)",
        message,
    )
    if city:
        value = safe_filter(city.group(1).rstrip("?.!,"))
        if value:
            filters["cidade"] = value
    return filters
