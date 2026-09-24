from __future__ import annotations

import logging

from logging_config import configure_application_logging


def test_application_logging_defaults_to_info(monkeypatch) -> None:
    monkeypatch.delenv("BI_LOG_LEVEL", raising=False)

    level = configure_application_logging()

    assert level == logging.INFO
    assert logging.getLogger("ceresbi.bi").isEnabledFor(logging.INFO)


def test_application_logging_honors_valid_level_and_bounds_invalid(monkeypatch) -> None:
    monkeypatch.setenv("BI_LOG_LEVEL", "WARNING")
    assert configure_application_logging() == logging.WARNING

    monkeypatch.setenv("BI_LOG_LEVEL", "not-a-level")
    assert configure_application_logging() == logging.INFO
