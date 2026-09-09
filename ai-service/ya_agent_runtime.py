"""Runtime discovery and safe invocation of installed BI RPC contracts."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from ai_logger import log_event


QueryFn = Callable[[str, tuple[Any, ...]], Awaitable[list[dict[str, Any]]]]
IDENTIFIER = re.compile(r"^[a-z_][a-z0-9_]*$")


class RuntimeFunctionUnavailable(RuntimeError):
    """Raised when the target database has no compatible installed RPC."""


@dataclass(frozen=True)
class FunctionSignature:
    function_name: str
    signature: str
    argument_names: tuple[str, ...]
    argument_text: str


def _names_from_argument_text(argument_text: str) -> tuple[str, ...]:
    names: list[str] = []
    for fragment in argument_text.split(","):
        candidate = fragment.strip().split(" ", 1)[0]
        if IDENTIFIER.fullmatch(candidate):
            names.append(candidate)
    return tuple(names)


def _argument_names(row: dict[str, Any]) -> tuple[str, ...]:
    raw_names = row.get("argument_names") or row.get("arg_names")
    if isinstance(raw_names, (list, tuple)):
        return tuple(str(name) for name in raw_names if IDENTIFIER.fullmatch(str(name)))
    argument_text = str(row.get("arguments") or "")
    return _names_from_argument_text(argument_text)


class RuntimeRpcAdapter:
    def __init__(self, query: QueryFn):
        self._query = query
        self._cache: dict[tuple[str, tuple[str, ...]], FunctionSignature] = {}

    async def discover(
        self,
        function_name: str,
        *,
        required_arguments: tuple[str, ...] = (),
    ) -> FunctionSignature:
        if not IDENTIFIER.fullmatch(function_name):
            raise RuntimeFunctionUnavailable("RPC não permitida")
        cache_key = (function_name, tuple(sorted(required_arguments)))
        if cache_key in self._cache:
            return self._cache[cache_key]
        rows = await self._query(
            """
            SELECT p.oid::regprocedure::text AS signature,
                   p.proargnames AS argument_names,
                   pg_get_function_arguments(p.oid) AS arguments
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = %s
            ORDER BY p.oid DESC
            """,
            (function_name,),
        )
        candidates = [
            FunctionSignature(
                function_name=function_name,
                signature=str(row.get("signature") or f"public.{function_name}"),
                argument_names=_argument_names(row),
                argument_text=str(row.get("arguments") or ""),
            )
            for row in rows
        ]
        required = set(required_arguments)
        selected = next((item for item in candidates if required.issubset(item.argument_names)), None)
        if selected is None:
            log_event(
                30,
                "ai_rpc_signature_unavailable",
                function=function_name,
                required=list(required_arguments),
            )
            raise RuntimeFunctionUnavailable("A fonte oficial não possui uma RPC compatível")
        self._cache[cache_key] = selected
        return selected

    async def call(
        self,
        function_name: str,
        values: dict[str, tuple[Any, str]],
        *,
        required_arguments: tuple[str, ...] = (),
    ) -> Any:
        signature = await self.discover(function_name, required_arguments=required_arguments)
        supplied = [name for name in signature.argument_names if name in values]
        missing = [name for name in required_arguments if name not in supplied]
        if missing:
            raise RuntimeFunctionUnavailable("A RPC instalada não aceita o recorte solicitado")
        if not supplied:
            rows = await self._query(f"SELECT public.{function_name}() AS payload", ())
            return rows[0].get("payload") if rows else {}
        arguments: list[str] = []
        params: list[Any] = []
        for name in supplied:
            value, cast = values[name]
            if not IDENTIFIER.fullmatch(name) or not IDENTIFIER.fullmatch(cast.replace("[]", "")):
                raise RuntimeFunctionUnavailable("Argumento interno da RPC inválido")
            arguments.append(f"{name} => %s::{cast}")
            params.append(value)
        rows = await self._query(
            f"SELECT public.{function_name}({', '.join(arguments)}) AS payload",
            tuple(params),
        )
        return rows[0].get("payload") if rows else {}
