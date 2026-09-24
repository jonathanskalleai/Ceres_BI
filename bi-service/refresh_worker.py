"""Periodic publisher for the rebuildable BI read models."""

from __future__ import annotations

import logging
import os
import time
from pathlib import Path

import psycopg2

logger = logging.getLogger("ceresbi.bi.refresh")


def read_secret(name: str) -> str:
    direct = os.getenv(name, "").strip()
    file_path = os.getenv(f"{name}_FILE", "").strip()
    if direct and file_path:
        raise RuntimeError(f"configure somente {name} ou {name}_FILE")
    if file_path:
        return Path(file_path).read_text(encoding="utf-8").strip()
    return direct


def positive_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    value = int(raw) if raw else default
    if value < 1:
        raise RuntimeError(f"{name} precisa ser >= 1")
    return value


def refresh_once(database_url: str, lookback_days: int, heartbeat_path: str | None = None) -> None:
    connection = psycopg2.connect(
        database_url,
        connect_timeout=5,
        application_name="ceresbi-bi-refresh",
        options="-c statement_timeout=120000 -c lock_timeout=5000",
    )
    try:
        with connection, connection.cursor() as cursor:
            cursor.execute(
                "SELECT bi.refresh_read_models(current_date - %s, current_date)",
                (lookback_days,),
            )
            result = cursor.fetchone()[0]
        if result.get("status") != "ready":
            raise RuntimeError(
                f"refresh não publicado; código={result.get('error_code', 'unknown')}"
            )
        # Publish the bounded semantic snapshot slice after the physical read
        # models commit. A snapshot failure is fail-open: DirectQuery remains
        # available and must not roll back the already healthy read models.
        connection.commit()
        try:
            with connection.cursor() as semantic_cursor:
                semantic_cursor.execute("SELECT bi.refresh_semantic_snapshots()")
                semantic_result = semantic_cursor.fetchone()[0]
            # The semantic publisher runs after the read-model transaction and
            # therefore needs its own commit.  Without this explicit boundary
            # psycopg2 rolls the successful snapshot writes back when the
            # worker closes the connection, making the log look healthy while
            # the published snapshot remains stale.
            connection.commit()
            if semantic_result.get("status") != "ready":
                logger.warning(
                    "bi_semantic_refresh_degraded code=%s",
                    semantic_result.get("error_code", "unknown"),
                )
            else:
                logger.info(
                    "bi_semantic_refresh_completed snapshots=%s",
                    semantic_result.get("snapshots", 0),
                )
        except Exception:
            connection.rollback()
            logger.exception("bi_semantic_refresh_failed")
        logger.info(
            "bi_refresh_completed status=%s run_id=%s rows=%s",
            result.get("status"),
            result.get("run_id"),
            result.get("row_count"),
        )
        if heartbeat_path:
            Path(heartbeat_path).write_text(str(time.time()), encoding="utf-8")
    finally:
        connection.close()


def main() -> None:
    logging.basicConfig(
        level=os.getenv("BI_REFRESH_LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    database_url = read_secret("BI_REFRESH_DATABASE_URL")
    if not database_url:
        raise RuntimeError("BI_REFRESH_DATABASE_URL não configurada")
    interval_seconds = positive_int("BI_REFRESH_INTERVAL_SECONDS", 900)
    lookback_days = positive_int("BI_REFRESH_LOOKBACK_DAYS", 730)
    heartbeat_path = os.getenv("BI_REFRESH_HEARTBEAT_FILE", "/tmp/bi-refresh-heartbeat").strip()

    while True:
        try:
            refresh_once(database_url, lookback_days, heartbeat_path or None)
        except Exception:
            logger.exception("bi_refresh_failed")
        time.sleep(interval_seconds)


if __name__ == "__main__":
    main()
