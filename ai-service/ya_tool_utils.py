"""Small, deterministic helpers shared by BI tool executors."""

from __future__ import annotations

import math
import re
from typing import Any


MAX_RESULT_ITEMS = 50
SENSITIVE_KEY = re.compile(r"(?:cpf|cnpj|email|telefone|phone|documento|clienteid|userid|user_id|cli_idcliente)", re.IGNORECASE)
SENSITIVE_TEXT = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[-.\s]?\d{4}")


def _path(value: Any, parts: tuple[str, ...]) -> Any:
    current = value
    for part in parts:
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def _compact(value: Any, depth: int = 0) -> Any:
    if depth > 4:
        return "…"
    if isinstance(value, dict):
        return {
            str(key): _compact(item, depth + 1)
            for key, item in list(value.items())[:32]
            if not SENSITIVE_KEY.search(str(key).replace("-", "_"))
        }
    if isinstance(value, list):
        return [_compact(item, depth + 1) for item in value[:MAX_RESULT_ITEMS]]
    if isinstance(value, str):
        return SENSITIVE_TEXT.sub("[oculto]", value[:320])
    return value


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def pearson(pairs: list[tuple[float, float]]) -> float | None:
    if len(pairs) < 3:
        return None
    xs, ys = zip(*pairs)
    mean_x, mean_y = sum(xs) / len(xs), sum(ys) / len(ys)
    numerator = sum((x - mean_x) * (y - mean_y) for x, y in pairs)
    denominator = math.sqrt(sum((x - mean_x) ** 2 for x in xs) * sum((y - mean_y) ** 2 for y in ys))
    return round(numerator / denominator, 4) if denominator else None


def _row_label(row: dict[str, Any]) -> str:
    for key in ("name", "nome", "consultor", "cidade", "produto", "label"):
        value = row.get(key)
        if value not in (None, ""):
            return str(value)
    return "(sem rótulo)"


def _row_measure(row: dict[str, Any]) -> float | None:
    for key in ("value", "valor", "qtd", "quantidade", "visitas", "oportunidades", "ganhos", "perdidos"):
        value = _number(row.get(key))
        if value is not None:
            return value
    return None


def _metric_row_measure(metric: Any, row: dict[str, Any]) -> float | None:
    value_path = getattr(metric, "value_path", ())
    key = value_path[-1] if value_path else ""
    candidates = [key]
    if key == "valorPipelineAbertoTocadoNoPeriodo":
        candidates.append("valorPipelineAberto")
    for candidate in candidates:
        value = _number(row.get(candidate))
        if value is not None:
            return value
    return _row_measure(row)


def _row_count(value: Any) -> int:
    if isinstance(value, dict):
        for key in ("rows", "series", "clientes", "matches", "values"):
            if isinstance(value.get(key), list):
                return len(value[key])
    return 1


def compare_data(current: Any, baseline: Any, metric: Any = None) -> dict[str, Any]:
    result: dict[str, Any] = {"atual": current, "anterior": baseline}
    if not isinstance(current, dict) or not isinstance(baseline, dict):
        return result
    current_value = _number(current.get("value"))
    baseline_value = _number(baseline.get("value"))
    if current_value is not None and baseline_value is not None:
        absolute = round(current_value - baseline_value, 4)
        result["variation"] = {
            "absolute": absolute,
            "percentage": round((absolute / baseline_value) * 100, 4) if baseline_value else None,
            "baseline_zero": baseline_value == 0,
        }
        return result
    current_rows = current.get("rows")
    baseline_rows = baseline.get("rows")
    if isinstance(current_rows, list) and isinstance(baseline_rows, list):
        measure = lambda row: _metric_row_measure(metric, row) if metric else _row_measure(row)
        current_index = {_row_label(row): measure(row) for row in current_rows if isinstance(row, dict)}
        baseline_index = {_row_label(row): measure(row) for row in baseline_rows if isinstance(row, dict)}
        changes = []
        for name in list(dict.fromkeys([*current_index.keys(), *baseline_index.keys()]))[:MAX_RESULT_ITEMS]:
            current_item, baseline_item = current_index.get(name), baseline_index.get(name)
            if current_item is None or baseline_item is None:
                changes.append({"name": name, "current": current_item, "baseline": baseline_item, "status": "new_or_missing"})
                continue
            absolute = round(current_item - baseline_item, 4)
            changes.append({"name": name, "current": current_item, "baseline": baseline_item, "absolute": absolute, "percentage": round((absolute / baseline_item) * 100, 4) if baseline_item else None, "baseline_zero": baseline_item == 0})
        result["variation"] = {"rows": changes}
    return result


DIMENSION_PATHS: dict[str, dict[str, tuple[str, ...]]] = {
    "sales_overview": {
        "vendedor": ("rankingVendedores",), "cidade": ("rankingCidades",), "produto": ("rankingProdutos",),
        "origem": ("origensLead",), "banco": ("financiamentoBancos",), "tipo_cliente": ("tiposCliente",),
        "motivo_perda": ("motivosPerda",),
    },
    "orders": {"vendedor": ("porVendedor",), "cidade": ("porCidade",), "status": ("porSituacao",)},
    "after_sales": {"status": ("porStatus",)},
    "funnel": {"consultor": ("rankingConsultores",)},
    "business_analysis": {
        "etapa": ("funilPorEtapa",), "origem": ("porOrigem",),
        "motivo_perda": ("motivosPerda",), "consultor": ("rankingConsultor",),
    },
}
