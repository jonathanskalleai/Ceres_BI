"""Post-generation factual guard for numbers in agent answers."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Iterable


NUMBER_TOKEN = re.compile(r"(?<![\w])[-+]?\d[\d.,]*(?:%|\b)")
LIST_MARKER = re.compile(r"^\s*\d+[.)]\s")


@dataclass(frozen=True)
class VerificationResult:
    valid: bool
    unknown_numbers: tuple[str, ...]
    checked_numbers: tuple[str, ...]


def verify_answer(answer: str, evidence: Iterable[Any]) -> VerificationResult:
    evidence_text = json.dumps(list(evidence), ensure_ascii=False, default=str)
    available = _numeric_forms(evidence_text)
    unknown: list[str] = []
    checked: list[str] = []
    for line in (answer or "").splitlines() or [answer or ""]:
        if LIST_MARKER.match(line):
            line = LIST_MARKER.sub("", line, count=1)
        for token in NUMBER_TOKEN.findall(line):
            cleaned = token.rstrip("%")
            forms = _token_forms(cleaned)
            if not forms:
                continue
            checked.append(cleaned)
            if not forms.intersection(available):
                unknown.append(cleaned)
    return VerificationResult(not unknown, tuple(dict.fromkeys(unknown)), tuple(checked))


def _numeric_forms(text: str) -> set[str]:
    forms: set[str] = set()
    for token in NUMBER_TOKEN.findall(text):
        forms.update(_token_forms(token.rstrip("%")))
    return forms


def _token_forms(token: str) -> set[str]:
    raw = token.strip().lstrip("+")
    if not raw or raw in {"-", ".", ","}:
        return set()
    sign = "-" if raw.startswith("-") else ""
    unsigned = raw.lstrip("-")
    digits = re.sub(r"\D", "", unsigned)
    if not digits:
        return set()
    forms = {sign + digits.lstrip("0") or "0"}
    separators = [index for index, char in enumerate(unsigned) if char in ".,"]
    if not separators:
        return forms
    last = max(separators)
    tail = unsigned[last + 1 :]
    head = unsigned[:last]
    if len(separators) > 1:
        # In pt-BR, the last separator is decimal; with a single final dot
        # followed by three digits, also retain the thousands interpretation.
        if unsigned[last] == "," or len(tail) != 3:
            _add_decimal(forms, sign, re.sub(r"\D", "", head), re.sub(r"\D", "", tail))
        forms.add(sign + digits.lstrip("0") or "0")
        return forms
    if unsigned[last] == "," or len(tail) in {1, 2}:
        _add_decimal(forms, sign, re.sub(r"\D", "", head), re.sub(r"\D", "", tail))
    elif unsigned[last] == "." and len(tail) == 3:
        forms.add(sign + digits.lstrip("0") or "0")
        _add_decimal(forms, sign, re.sub(r"\D", "", head), re.sub(r"\D", "", tail))
    else:
        _add_decimal(forms, sign, re.sub(r"\D", "", head), re.sub(r"\D", "", tail))
    return forms


def _add_decimal(forms: set[str], sign: str, head: str, tail: str) -> None:
    if not tail:
        return
    try:
        value = Decimal(f"{sign}{head or '0'}.{tail}").normalize()
        formatted = format(value, "f")
        if "." in formatted:
            formatted = formatted.rstrip("0").rstrip(".")
        forms.add(formatted or "0")
    except InvalidOperation:
        return
