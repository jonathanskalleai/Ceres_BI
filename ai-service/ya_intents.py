"""Language-level intent detection shared by the semantic planner and API."""

from __future__ import annotations

import unicodedata
from typing import Any


def normalize_text(value: Any) -> str:
    raw = " ".join(str(value or "").split()).casefold()
    return "".join(
        char for char in unicodedata.normalize("NFD", raw)
        if unicodedata.category(char) != "Mn"
    )


def conversational_mode(message: str) -> str | None:
    """Recognize turns that must not be forced through the metric catalog."""
    text = normalize_text(message).strip(" !?,.;:")
    if not text:
        return None
    greetings = (
        "oi", "ola", "olá", "bom dia", "boa tarde", "boa noite", "obrigado",
        "obrigada", "valeu", "tchau", "ate mais", "até mais",
    )
    if any(text == greeting or text.startswith(f"{greeting} ") for greeting in greetings):
        if len(text.split()) <= 5:
            return "conversation"
    source_phrases = (
        "de onde voce tirou", "de onde tirou", "de onde veio essa informacao",
        "de onde veio esse numero", "de onde veio esse valor", "qual a fonte",
        "qual foi a fonte", "como foi calcul",
        "como chegou nesse", "como chegou neste", "como esse numero",
        "como esse valor", "origem dessa informacao", "origem desse numero",
        "origem desse valor", "por que esse numero", "por que esse valor",
        "porque esse numero", "porque esse valor", "qual foi a origem dessa",
    )
    if any(phrase in text for phrase in source_phrases):
        return "source"
    conversational_phrases = (
        "qual a proxima pergunta", "o que voce pode fazer", "o que você pode fazer",
        "me ajude", "nao gostei", "não gostei", "nao entendi", "não entendi",
        "explique melhor", "isso nao faz sentido", "isso não faz sentido",
    )
    if any(phrase in text for phrase in conversational_phrases):
        data_follow_up = (
            "qual ", "quanto", "quantos", "mostre", "compare", "liste", "total",
            "faturamento", "vendas", "negocio", "negocios", "pedido", "pedidos",
            "visita", "cliente", "produto", "servico", "perda", "pipeline", "periodo",
        )
        if any(term in text for term in data_follow_up):
            return None
        return "conversation"
    return None
