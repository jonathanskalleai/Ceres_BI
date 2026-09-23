"""Configuration for the isolated BI API service."""

from __future__ import annotations

import os
from dataclasses import dataclass


def _int_env(name: str, default: int, *, minimum: int = 1) -> int:
    raw = os.getenv(name, "")
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} precisa ser um inteiro") from exc
    if value < minimum:
        raise RuntimeError(f"{name} precisa ser >= {minimum}")
    return value


def _float_env(name: str, default: float, *, minimum: float = 0.0) -> float:
    raw = os.getenv(name, "")
    if not raw:
        return default
    try:
        value = float(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} precisa ser numérico") from exc
    if value < minimum:
        raise RuntimeError(f"{name} precisa ser >= {minimum}")
    return value


@dataclass(frozen=True)
class Settings:
    database_url: str
    jwt_secret: str
    jwt_audience: str
    pool_min: int
    pool_max: int
    statement_timeout_ms: int
    lock_timeout_ms: int
    cache_ttl_seconds: float
    cache_max_items: int
    cors_origins: tuple[str, ...]

    @classmethod
    def from_env(cls) -> Settings:
        pool_min = _int_env("BI_DATABASE_POOL_MIN", 1)
        pool_max = _int_env("BI_DATABASE_POOL_MAX", 8)
        if pool_max < pool_min:
            raise RuntimeError("BI_DATABASE_POOL_MAX precisa ser >= BI_DATABASE_POOL_MIN")
        origins = tuple(
            origin.strip()
            for origin in os.getenv(
                "BI_CORS_ORIGINS",
                "https://ceresbi.vouxconsultoria.com.br",
            ).split(",")
            if origin.strip()
        )
        return cls(
            database_url=os.getenv("BI_DATABASE_URL", "").strip(),
            jwt_secret=(
                os.getenv("BI_SUPABASE_JWT_SECRET", "")
                or os.getenv("SUPABASE_JWT_SECRET", "")
            ).strip(),
            jwt_audience=os.getenv("BI_SUPABASE_JWT_AUDIENCE", "authenticated").strip(),
            pool_min=pool_min,
            pool_max=pool_max,
            statement_timeout_ms=_int_env("BI_STATEMENT_TIMEOUT_MS", 30_000),
            lock_timeout_ms=_int_env("BI_LOCK_TIMEOUT_MS", 5_000),
            cache_ttl_seconds=_float_env("BI_CACHE_TTL_SECONDS", 5.0),
            cache_max_items=_int_env("BI_CACHE_MAX_ITEMS", 512),
            cors_origins=origins,
        )
