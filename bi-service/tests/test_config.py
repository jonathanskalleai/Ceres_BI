from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import Settings  # noqa: E402


SECRET_ENV_NAMES = (
    "BI_DATABASE_URL",
    "BI_DATABASE_URL_FILE",
    "BI_SUPABASE_JWT_SECRET",
    "BI_SUPABASE_JWT_SECRET_FILE",
    "SUPABASE_JWT_SECRET",
    "SUPABASE_JWT_SECRET_FILE",
)


@pytest.fixture(autouse=True)
def clear_secret_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in SECRET_ENV_NAMES:
        monkeypatch.delenv(name, raising=False)


def test_settings_read_docker_secret_files(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    database_url = tmp_path / "database_url"
    jwt_secret = tmp_path / "jwt_secret"
    database_url.write_text("postgresql://ceres_bi_api:secret@db/postgres\n")
    jwt_secret.write_text("jwt-secret\n")
    monkeypatch.setenv("BI_DATABASE_URL_FILE", str(database_url))
    monkeypatch.setenv("BI_SUPABASE_JWT_SECRET_FILE", str(jwt_secret))

    settings = Settings.from_env()

    assert settings.database_url == "postgresql://ceres_bi_api:secret@db/postgres"
    assert settings.jwt_secret == "jwt-secret"


def test_settings_reject_ambiguous_direct_and_file_secret(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    database_url = tmp_path / "database_url"
    database_url.write_text("postgresql://file-value")
    monkeypatch.setenv("BI_DATABASE_URL", "postgresql://direct-value")
    monkeypatch.setenv("BI_DATABASE_URL_FILE", str(database_url))

    with pytest.raises(RuntimeError, match="nunca ambos"):
        Settings.from_env()


def test_settings_fails_when_secret_file_is_missing(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("BI_DATABASE_URL_FILE", str(tmp_path / "missing"))

    with pytest.raises(RuntimeError, match="não foi possível ler"):
        Settings.from_env()


def test_settings_supports_legacy_jwt_file_fallback(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    jwt_secret = tmp_path / "jwt_secret"
    jwt_secret.write_text("legacy-jwt")
    monkeypatch.setenv("SUPABASE_JWT_SECRET_FILE", str(jwt_secret))

    assert Settings.from_env().jwt_secret == "legacy-jwt"
