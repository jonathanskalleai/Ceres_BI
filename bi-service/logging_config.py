"""Production logging bootstrap for the BI service."""

from __future__ import annotations

import logging
import os


def configure_application_logging() -> int:
    """Enable structured BI events without overriding Uvicorn handlers."""

    requested = os.getenv("BI_LOG_LEVEL", "INFO").strip().upper()
    level = logging.getLevelNamesMapping().get(requested, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    # Uvicorn may configure logging before importing the application. Setting
    # the project logger explicitly keeps INFO metrics visible in that case;
    # propagation reuses the server handler instead of adding a duplicate one.
    logging.getLogger("ceresbi.bi").setLevel(level)
    return level
