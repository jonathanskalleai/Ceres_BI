"""Small deterministic responses for conversational and source turns."""

from __future__ import annotations

from typing import Any

from ya_models import YaSource


def greeting_answer(message: str) -> str | None:
    normalized = " ".join(message.casefold().split())
    if "bom dia" in normalized:
        return "Bom dia! Estou aqui para conversar e consultar os dados do Ceres BI. Pode me fazer uma pergunta."
    if "boa tarde" in normalized:
        return "Boa tarde! Estou aqui para conversar e consultar os dados do Ceres BI. Pode me fazer uma pergunta."
    if "boa noite" in normalized:
        return "Boa noite! Estou aqui para conversar e consultar os dados do Ceres BI. Pode me fazer uma pergunta."
    if normalized in {"oi", "olá", "ola"}:
        return "Olá! Estou aqui para conversar e consultar os dados do Ceres BI. O que você quer investigar?"
    if normalized in {"obrigado", "obrigada", "valeu"}:
        return "De nada! Quando quiser, posso investigar os dados do BI com você."
    return None


def _date_label(value: Any) -> str:
    text = str(value or "")
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        return f"{text[8:10]}/{text[5:7]}/{text[:4]}"
    return text


def source_answer(sources: list[YaSource]) -> str:
    if not sources:
        return "Ainda não consultei uma fonte de dados nesta conversa. Faça primeiro uma pergunta sobre o BI e depois me pergunte de onde veio a informação."
    parts: list[str] = []
    for source in sources[:3]:
        lineage = source.lineage or {}
        tables = lineage.get("tables")
        if isinstance(tables, list) and tables:
            origin = f"uma consulta somente leitura às tabelas {', '.join(str(item) for item in tables[:6])}"
        else:
            origin = f"o contrato {lineage.get('executor') or source.label}"
        sentence = f"A resposta anterior veio de {source.label}, usando {origin}."
        is_dynamic = lineage.get("executor") == "dynamic_read_only"
        if is_dynamic:
            sentence += " Foi uma investigação aberta para esta pergunta, não o contrato de um card específico da dashboard."
        if source.metric_definitions:
            definition = source.metric_definitions[0]
            sentence += f" A regra de {definition.get('label', 'métrica')} foi: {definition.get('definition', 'definição do catálogo')}."
            if definition.get("competence"):
                sentence += f" A competência foi {definition['competence']}."
            if definition.get("deduplication"):
                sentence += f" Deduplicação: {definition['deduplication']}."
        scope = source.applied_scope or {}
        period = scope.get("period") if isinstance(scope, dict) else None
        if isinstance(period, dict) and period.get("from") and period.get("to"):
            sentence += f" O período foi {_date_label(period['from'])} a {_date_label(period['to'])}."
        filters = scope.get("filters") if isinstance(scope, dict) else None
        if isinstance(filters, dict) and filters:
            readable = [f"{key}={value}" for key, value in filters.items() if value not in (None, "", [], {}) and "id" not in str(key).casefold()]
            if readable:
                label = "Contexto enviado para a consulta" if is_dynamic else "Filtros aplicados"
                sentence += f" {label}: {', '.join(readable[:6])}."
        refreshed = source.freshness.get("refreshed_at") if source.freshness else None
        if refreshed:
            sentence += f" O mirror informava atualização em {_date_label(refreshed)}."
        if source.warnings:
            sentence += f" Aviso: {source.warnings[0]}"
        parts.append(sentence)
    return "\n\n".join(parts)
