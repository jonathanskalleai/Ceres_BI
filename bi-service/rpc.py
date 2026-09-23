"""Allow-listed Ações RPC calls; business semantics stay in PostgreSQL."""

from __future__ import annotations

from typing import Any

from db import ReadOnlyDatabase
from schemas import AcoesDetalheFilters, AcoesFilters


def fetch_core(database: ReadOnlyDatabase, filters: AcoesFilters) -> Any:
    return database.execute_rpc("rpc_acoes_bi_periodo", (
        filters.from_, filters.to, filters.vendedor, filters.tipoAcao, filters.cidade,
    ))

def fetch_detalhe(database: ReadOnlyDatabase, filters: AcoesDetalheFilters) -> Any:
    return database.execute_rpc("rpc_acoes_detalhe", (
        filters.from_, filters.to, filters.vendedor, filters.tipoAcao, filters.cidade,
        filters.limit, filters.offset, filters.statusNegocio,
    ))


def fetch_funil(database: ReadOnlyDatabase, filters: AcoesFilters) -> Any:
    return database.execute_rpc("rpc_acoes_funil_gestao_periodo", (
        filters.from_, filters.to, filters.vendedor, filters.cidade,
    ))


def fetch_mapa(database: ReadOnlyDatabase, filters: AcoesFilters) -> Any:
    return database.execute_rpc("rpc_acoes_mapa_oportunidades", (
        filters.vendedor, filters.cidade, filters.from_, filters.to,
    ))
