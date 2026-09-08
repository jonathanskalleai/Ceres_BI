"""Authentication and BI access checks shared by the AI endpoints.

The browser already sends the Supabase access token.  The API must validate it
itself because it has a direct database connection and therefore is outside
PostgREST's RLS boundary.
"""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass
from typing import Annotated

import jwt
import psycopg2
from fastapi import Depends, Header, HTTPException, status


DATABASE_URL = os.getenv("DATABASE_URL", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
SUPABASE_JWT_AUDIENCE = os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated")


@dataclass(frozen=True)
class CurrentUser:
    id: str
    role: str
    full_name: str


def _unauthorized(detail: str = "Sessão inválida ou expirada") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _database_user(user_id: str, *, require_ya_access: bool) -> CurrentUser:
    if not DATABASE_URL:
        raise HTTPException(status_code=503, detail="Banco de dados da IA não configurado")

    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT p.role, p.full_name,
                       EXISTS (
                         SELECT 1
                         FROM public.user_permissions up
                         WHERE up.user_id = p.id
                           AND up.module_id = 'bi.ya'
                       ) AS can_use_ya
                FROM public.profiles p
                WHERE p.id = %s::uuid
                  AND p.is_active = true
                """,
                (user_id,),
            )
            row = cur.fetchone()
    except psycopg2.Error as exc:
        raise HTTPException(status_code=503, detail="Não foi possível validar o acesso à AI") from exc
    finally:
        if conn:
            conn.close()

    if not row:
        raise _unauthorized("Usuário inativo ou não encontrado")

    role, full_name, can_use_ya = row
    if require_ya_access and role != "admin" and not can_use_ya:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem acesso à AI neste ambiente",
        )
    return CurrentUser(id=user_id, role=role, full_name=full_name or "")


def _decode_access_token(authorization: str | None) -> str:
    """Decode the bearer token once, independent of the target AI feature."""
    if not SUPABASE_JWT_SECRET:
        raise HTTPException(status_code=503, detail="Validação JWT da AI não configurada")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise _unauthorized()

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise _unauthorized()

    try:
        claims = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience=SUPABASE_JWT_AUDIENCE,
            options={"require": ["exp", "sub"]},
        )
        return str(uuid.UUID(str(claims["sub"])))
    except (jwt.PyJWTError, ValueError, KeyError) as exc:
        raise _unauthorized() from exc


async def require_authenticated_user(
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    """Validate a Supabase JWT for existing authenticated AI endpoints."""
    return _database_user(_decode_access_token(authorization), require_ya_access=False)


async def require_bi_user(
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    """Validate a Supabase JWT and require the explicit AI BI permission.

    This intentionally fails closed when the JWT secret is absent. Deploying
    the chat without that secret would recreate the old unauthenticated AI API.
    """
    return _database_user(_decode_access_token(authorization), require_ya_access=True)


AuthenticatedUser = Annotated[CurrentUser, Depends(require_authenticated_user)]
AuthenticatedBIUser = Annotated[CurrentUser, Depends(require_bi_user)]
