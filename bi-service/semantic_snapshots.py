"""Read helpers for published semantic dashboard snapshots."""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import date, datetime, timezone
from typing import Any

from db import ReadOnlyDatabase
from schemas import BiSnapshot

LOGGER = logging.getLogger("ceresbi.bi.semantic.snapshots")


def normalize_filters(filters: dict[str, Any]) -> dict[str, Any]:
    """Return the stable, JSON-compatible filter representation used by refresh jobs."""
    normalized: dict[str, Any] = {}
    for key, value in sorted(filters.items()):
        if value is None or value == "" or value == []:
            continue
        if isinstance(value, (date, datetime)):
            normalized[key] = value.isoformat()
        elif isinstance(value, tuple):
            normalized[key] = list(value)
        else:
            normalized[key] = value
    return normalized


def semantic_filter_key(filters: dict[str, Any]) -> str:
    encoded = json.dumps(
        normalize_filters(filters),
        ensure_ascii=True,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def fetch_semantic_snapshot(
    database: ReadOnlyDatabase,
    dashboard_id: str,
    filters: dict[str, Any],
    max_age_seconds: int,
) -> tuple[Any, BiSnapshot] | None:
    """Return a fresh, coverage-compatible snapshot or ``None`` for DirectQuery fallback."""
    try:
        rows = database.execute_query(
            "SELECT payload, status, data_version, source_from, source_to, snapshot_at "
            "FROM bi.semantic_snapshots WHERE dashboard_id = %s AND filters = %s::jsonb LIMIT 1",
            (dashboard_id, json.dumps(normalize_filters(filters), ensure_ascii=True, separators=(",", ":"))),
        )
    except Exception:
        LOGGER.warning("semantic_snapshot_unavailable dashboard=%s", dashboard_id, exc_info=True)
        return None
    if not rows:
        return None
    row = rows[0]
    if row.get("status") != "ready" or row.get("payload") is None:
        return None

    snapshot_at = row.get("snapshot_at")
    if isinstance(snapshot_at, str):
        snapshot_at = datetime.fromisoformat(snapshot_at.replace("Z", "+00:00"))
    if not isinstance(snapshot_at, datetime):
        return None
    if snapshot_at.tzinfo is None:
        snapshot_at = snapshot_at.replace(tzinfo=timezone.utc)
    if (datetime.now(timezone.utc) - snapshot_at).total_seconds() > max_age_seconds:
        return None

    normalized = normalize_filters(filters)
    requested_from = normalized.get("p_from") or normalized.get("from")
    requested_to = normalized.get("p_to") or normalized.get("to")
    source_from = row.get("source_from")
    source_to = row.get("source_to")
    if isinstance(source_from, str):
        source_from = date.fromisoformat(source_from)
    if isinstance(source_to, str):
        source_to = date.fromisoformat(source_to)
    if requested_from and source_from and date.fromisoformat(str(requested_from)) < source_from:
        return None
    if requested_to and source_to and date.fromisoformat(str(requested_to)) > source_to:
        return None

    metadata = BiSnapshot(
        model=dashboard_id,
        version=f"etl-{row.get('data_version')}",
        snapshot_at=snapshot_at.isoformat(),
        status="ready",
        is_stale=False,
        source="read_model",
    )
    return row["payload"], metadata
