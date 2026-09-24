"""Supabase JWT and dashboard authorization for direct PostgreSQL access."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Annotated

import jwt
import psycopg2
from fastapi import Header, HTTPException, status

from config import Settings
from db import ReadOnlyDatabase


@dataclass(frozen=True)
class CurrentUser:
    id: str
    role: str


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sessão inválida ou expirada",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _decode_token(authorization: str | None, settings: Settings) -> str:
    if not settings.jwt_secret:
        raise HTTPException(status_code=503, detail="Validação JWT do BI não configurada")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise _unauthorized()
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise _unauthorized()
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            audience=settings.jwt_audience,
            options={"require": ["exp", "sub"]},
        )
        return str(uuid.UUID(str(claims["sub"])))
    except (jwt.PyJWTError, ValueError, KeyError, TypeError) as exc:
        raise _unauthorized() from exc


def _load_dashboard_user(database: ReadOnlyDatabase, user_id: str, modules: tuple[str, ...]) -> CurrentUser:
    try:
        with database.connection() as conn, conn.cursor() as cursor:
            # profiles and user_permissions are protected by application
            # RLS policies that depend on auth.uid(). The BI service has
            # already verified the Supabase JWT, but it does not inject
            # that JWT into a database session. Use the narrowly-scoped
            # SECURITY DEFINER authorization helper instead of granting
            # the API role RLS bypass or broad table access.
            cursor.execute(
                """
                    SELECT user_role, can_use_dashboard
                    FROM public.rpc_bi_authorize_user(%s::uuid, %s::text[])
                    """,
                (user_id, list(modules)),
            )
            row = cursor.fetchone()
    except psycopg2.Error as exc:
        raise HTTPException(status_code=503, detail="Não foi possível validar o acesso ao BI") from exc
    if not row:
        raise _unauthorized()
    role, can_use_dashboard = row
    if role != "admin" and not can_use_dashboard:
        raise HTTPException(status_code=403, detail="Você não tem acesso a esta dashboard BI")
    return CurrentUser(id=user_id, role=role)


def authenticate_bi_user(
    authorization: str | None,
    settings: Settings,
    database: ReadOnlyDatabase,
    modules: tuple[str, ...] = ("bi.acoes",),
) -> CurrentUser:
    user_id = _decode_token(authorization, settings)
    return _load_dashboard_user(database, user_id, modules)


def make_bi_user_dependency(
    settings: Settings,
    database: ReadOnlyDatabase,
    modules: tuple[str, ...] = ("bi.acoes",),
):
    async def require_bi_user(
        authorization: Annotated[str | None, Header()] = None,
    ) -> CurrentUser:
        return authenticate_bi_user(authorization, settings, database, modules)

    return require_bi_user
