"""Allow-listed SQL access to the physical BI read models."""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import HTTPException

from db import ReadOnlyDatabase

_MODEL_COLUMNS: dict[str, tuple[str, ...]] = {
    "acoes_daily": (
        "day", "vendedor", "cidade", "tipo_acao", "total_acoes",
        "acoes_concluidas", "acoes_validas", "visitas", "geolocalizadas",
    ),
    "negocios_daily": (
        "day", "vendedor", "cidade", "funil", "etapa", "conclusao",
        "total_negocios", "valor_total",
    ),
    "pedidos_daily": (
        "day", "vendedor", "cidade", "situacao", "total_pedidos", "valor_total",
    ),
    "servicos_daily": ("day", "cidade", "status", "total_os", "os_encerradas"),
}

_MODEL_FILTERS: dict[str, tuple[str, ...]] = {
    "acoes_daily": ("vendedor", "cidade"),
    "negocios_daily": ("vendedor", "cidade"),
    "pedidos_daily": ("vendedor", "cidade"),
    "servicos_daily": ("cidade",),
}


def build_read_model_query(
    model_name: str,
    from_date: date,
    to_date: date,
    vendedor: str | None,
    cidade: str | None,
    limit: int,
    offset: int = 0,
) -> tuple[str, tuple[Any, ...]]:
    if model_name not in _MODEL_COLUMNS:
        raise HTTPException(status_code=404, detail="Read model não permitido")

    columns = ", ".join(_MODEL_COLUMNS[model_name])
    conditions = ["day BETWEEN %s AND %s"]
    args: list[Any] = [from_date, to_date]
    if vendedor and "vendedor" in _MODEL_FILTERS[model_name]:
        conditions.append("vendedor = %s")
        args.append(vendedor)
    if cidade and "cidade" in _MODEL_FILTERS[model_name]:
        conditions.append("cidade = %s")
        args.append(cidade)
    query = (
        f"SELECT {columns} FROM bi.{model_name} "
        f"WHERE {' AND '.join(conditions)} ORDER BY day ASC LIMIT %s OFFSET %s"
    )
    args.append(limit)
    args.append(offset)
    return query, tuple(args)


def fetch_read_model(
    database: ReadOnlyDatabase,
    model_name: str,
    from_date: date,
    to_date: date,
    vendedor: str | None,
    cidade: str | None,
    limit: int,
    offset: int = 0,
) -> dict[str, object]:
    query, args = build_read_model_query(
        model_name, from_date, to_date, vendedor, cidade, limit + 1, offset
    )
    fetched_rows = database.execute_query(query, args)
    has_more = len(fetched_rows) > limit
    rows = fetched_rows[:limit]
    manifest_rows = database.execute_query(
        "SELECT model_name, status, data_version, source_from, source_to, row_count, "
        "last_completed_at, last_error_code FROM bi.refresh_manifest WHERE model_name = %s",
        (model_name,),
    )
    manifest = manifest_rows[0] if manifest_rows else None
    return {
        "model": model_name,
        "rows": rows,
        "manifest": manifest,
        "pagination": {"limit": limit, "offset": offset, "has_more": has_more},
    }


def fetch_read_model_status(database: ReadOnlyDatabase) -> dict[str, object]:
    manifest = database.execute_query(
        "SELECT model_name, status, data_version, source_from, source_to, row_count, "
        "last_started_at, last_completed_at, last_error_code "
        "FROM bi.refresh_manifest ORDER BY model_name"
    )
    quality = database.execute_query("SELECT * FROM bi.read_model_quality()")
    ready = bool(quality) and all(row.get("status") == "ready" for row in quality)
    return {"status": "ready" if ready else "degraded", "manifest": manifest, "quality": quality}
