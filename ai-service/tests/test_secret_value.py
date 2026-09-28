from __future__ import annotations

from pathlib import Path

import pytest

from secret_value import read_secret


def test_read_secret_prefers_file_mount(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    secret_file = tmp_path / "secret"
    secret_file.write_text("value-from-file\n", encoding="utf-8")
    monkeypatch.delenv("CERES_TEST_SECRET", raising=False)
    monkeypatch.setenv("CERES_TEST_SECRET_FILE", str(secret_file))

    assert read_secret("CERES_TEST_SECRET") == "value-from-file"


def test_read_secret_rejects_direct_and_file_together(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    secret_file = tmp_path / "secret"
    secret_file.write_text("file-value", encoding="utf-8")
    monkeypatch.setenv("CERES_TEST_SECRET", "direct-value")
    monkeypatch.setenv("CERES_TEST_SECRET_FILE", str(secret_file))

    with pytest.raises(RuntimeError, match="configure somente"):
        read_secret("CERES_TEST_SECRET")
