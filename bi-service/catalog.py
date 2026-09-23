"""Allow-listed read-only RPC catalog shared by every BI dashboard."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any

from fastapi import HTTPException


@dataclass(frozen=True)
class RpcSpec:
    args: tuple[str, ...]
    modules: tuple[str, ...]
    required: tuple[str, ...] = ()


_COMMON_COMMERCIAL = ("bi.painel", "bi.comercial", "bi.desempenho")
_ACOES = ("bi.acoes", "bi.painel", "bi.comercial")
_COMMERCIAL_READ = ("bi.painel", "bi.comercial", "bi.desempenho")


RPC_CATALOG: dict[str, RpcSpec] = {
    "rpc_negocios_bi": RpcSpec(("p_from", "p_to", "p_funis", "p_cidade", "p_vendedor"), _COMMON_COMMERCIAL, ("p_from", "p_to")),
    "rpc_negocios_crm": RpcSpec(("p_from", "p_to", "p_cidade", "p_vendedor"), ("bi.painel", "bi.comercial")),
    "rpc_resultados_negocios_bi": RpcSpec(("p_from", "p_to", "p_vendedor", "p_cidade"), _COMMON_COMMERCIAL, ("p_from", "p_to")),
    "rpc_negocios_bi_expandido": RpcSpec(("p_from", "p_to", "p_vendedor", "p_cidade"), _COMMON_COMMERCIAL, ("p_from", "p_to")),
    "rpc_acoes_bi": RpcSpec(("p_from", "p_to", "p_vendedor", "p_tipo_acao", "p_cidade"), _ACOES),
    "rpc_pedidos_bi": RpcSpec(("p_from", "p_to", "p_cidade", "p_vendedor"), ("bi.pedidos", "bi.painel", "bi.comercial"), ("p_from", "p_to")),
    "rpc_pedidos_pendentes_esteira": RpcSpec(("p_from", "p_to", "p_ano", "p_vendedor", "p_cidade", "p_funis"), ("bi.desempenho", "bi.pedidos", "bi.painel")),
    "rpc_servicos_bi": RpcSpec(("p_from", "p_to", "p_cidade"), ("bi.servicos", "bi.operacional"), ("p_from", "p_to")),
    "rpc_admin_bi": RpcSpec(("p_cidade",), ("bi.admin", "bi.comercial", "bi.painel")),
    "rpc_inteligencia_esforco_bi": RpcSpec(("p_from", "p_to", "p_funis"), ("bi.inteligencia", "bi.comercial", "bi.servicos"), ("p_from", "p_to")),
    "rpc_parque_renovacao_bi": RpcSpec(("p_cutoff_anos",), ("bi.produtos", "bi.comercial")),
    "rpc_operacional_bi": RpcSpec((), ("bi.operacional", "bi.servicos")),
    "rpc_produtos_bi": RpcSpec((), ("bi.produtos", "bi.comercial")),
    "rpc_desempenho_vendas_bi": RpcSpec(("p_from", "p_to", "p_ano", "p_vendedor", "p_cidade", "p_condicao", "p_produto", "p_origem", "p_banco", "p_motivo_perda", "p_funis"), ("bi.desempenho",), ()),
    "rpc_kpis_comercial": RpcSpec(("p_from", "p_to", "p_vendedor"), _COMMERCIAL_READ, ("p_from", "p_to")),
    "rpc_evolucao_mensal": RpcSpec(("p_from", "p_to", "p_vendedor"), _COMMERCIAL_READ, ("p_from", "p_to")),
    "rpc_evolucao_ganhos_perdidos_12m": RpcSpec(("p_vendedor", "p_from", "p_to"), _COMMERCIAL_READ),
    "rpc_evolucao_negocios_12m": RpcSpec(("p_vendedor",), _COMMERCIAL_READ),
    "rpc_evolucao_tipos_acao_12m": RpcSpec(("p_vendedor", "p_limit"), _COMMERCIAL_READ),
    "rpc_ranking_vendedores": RpcSpec(("p_from", "p_to", "p_limit"), _COMMERCIAL_READ, ("p_from", "p_to")),
    "rpc_ranking_vendedores_v2": RpcSpec(("p_from", "p_to", "p_limit"), _COMMERCIAL_READ, ("p_from", "p_to")),
    "rpc_ranking_regioes": RpcSpec(("p_from", "p_to", "p_limit"), _COMMERCIAL_READ, ("p_from", "p_to")),
    "rpc_clientes_por_vendedor": RpcSpec(("p_vendedor", "p_from", "p_to"), _COMMERCIAL_READ, ("p_vendedor", "p_from", "p_to")),
    "rpc_registros_recentes": RpcSpec(("p_from", "p_to", "p_vendedor", "p_cidade", "p_limit"), _COMMERCIAL_READ),
    "rpc_listas_filtros": RpcSpec(("p_from", "p_to"), _COMMERCIAL_READ, ("p_from", "p_to")),
    "rpc_consultor_negocios_pipeline": RpcSpec(("p_consultor", "p_limite"), _COMMERCIAL_READ, ("p_consultor",)),
    "rpc_consultores_resumo_acoes": RpcSpec(("p_from", "p_to", "p_vendedor", "p_cidade", "p_tipo_acao"), _COMMERCIAL_READ, ("p_from", "p_to")),
    "rpc_equipe_desempenho_mensal": RpcSpec(("p_ano", "p_consultor", "p_cidade"), ("bi.desempenho", "bi.comercial"), ("p_ano",)),
    "rpc_equipe_desempenho_mensal_v2": RpcSpec(("p_ano", "p_consultor", "p_cidade"), ("bi.desempenho", "bi.comercial"), ("p_ano",)),
    "rpc_acoes_bi_periodo": RpcSpec(("p_from", "p_to", "p_vendedor", "p_tipo_acao", "p_cidade"), _ACOES),
    "rpc_acoes_detalhe": RpcSpec(("p_from", "p_to", "p_vendedor", "p_tipo_acao", "p_cidade", "p_limit", "p_offset", "p_status"), _ACOES, ("p_from", "p_to")),
    "rpc_acoes_visitas_mensal": RpcSpec(("p_from", "p_to", "p_vendedor", "p_tipo_acao", "p_cidade"), _ACOES),
    "rpc_acoes_evolucao_mensal_ano_corrente": RpcSpec(("p_vendedor", "p_tipo_acao", "p_cidade"), _ACOES),
    "rpc_acoes_clientes_risco": RpcSpec(("p_vendedor", "p_cidade"), _ACOES),
    "rpc_clientes_criticos_bi": RpcSpec(("p_vendedor", "p_cidade", "p_dias_min", "p_limit"), _ACOES),
    "rpc_clientes_criticos_legacy": RpcSpec(("p_dias_limite",), ("bi.painel", "bi.comercial")),
    "rpc_acoes_em_andamento": RpcSpec(("p_from", "p_to", "p_vendedor", "p_cidade", "p_limit", "p_offset"), _ACOES),
    "rpc_acoes_funil_gestao": RpcSpec(("p_from", "p_to", "p_vendedor", "p_cidade"), _ACOES),
    "rpc_acoes_funil_gestao_periodo": RpcSpec(("p_from", "p_to", "p_vendedor", "p_cidade"), _ACOES),
    "rpc_acoes_taxa_ganho_negocios": RpcSpec(("p_from", "p_to", "p_vendedor", "p_cidade"), _ACOES),
    "rpc_acoes_gestao_listas": RpcSpec(("p_tipo", "p_from", "p_to", "p_vendedor", "p_cidade", "p_limit", "p_offset", "p_search", "p_dias_min", "p_dias_max"), _ACOES, ("p_tipo",)),
    "rpc_acoes_desperdicio_ano_corrente": RpcSpec(("p_vendedor", "p_cidade", "p_limit", "p_offset", "p_search"), _ACOES),
    "rpc_acoes_mapa_oportunidades": RpcSpec(("p_vendedor", "p_cidade", "p_from", "p_to"), _ACOES),
    "rpc_acoes_pedidos_ganhos": RpcSpec(("p_from", "p_to", "p_vendedor", "p_cidade", "p_limit", "p_offset", "p_funis"), _ACOES, ("p_from", "p_to")),
    "rpc_acoes_negocios_perdidos": RpcSpec(("p_from", "p_to", "p_vendedor", "p_cidade", "p_limit", "p_offset", "p_funis"), _ACOES, ("p_from", "p_to")),
    "rpc_acoes_termometro_fechamento": RpcSpec(("p_from", "p_to", "p_vendedor", "p_cidade", "p_escopo"), _ACOES),
    "rpc_etl_status": RpcSpec((), ("bi.etl-monitor", "bi.admin")),
    "rpc_etl_log": RpcSpec(("p_table_name", "p_limit"), ("bi.etl-monitor", "bi.admin")),
}

_TEXT_LIMIT = 160
_ARRAY_LIMIT = 100


def get_spec(rpc_name: str) -> RpcSpec:
    try:
        return RPC_CATALOG[rpc_name]
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Consulta BI não permitida") from exc


def _validate_value(name: str, value: Any) -> Any:
    if value is None:
        return None
    if name in {"p_from", "p_to"}:
        if not isinstance(value, str):
            raise HTTPException(status_code=422, detail=f"{name} precisa ser uma data ISO")
        try:
            return date.fromisoformat(value)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"{name} precisa ser uma data ISO") from exc
    if isinstance(value, str) and len(value) > _TEXT_LIMIT:
        raise HTTPException(status_code=422, detail=f"{name} excede o limite de tamanho")
    if isinstance(value, list):
        if len(value) > _ARRAY_LIMIT or not all(isinstance(item, str) for item in value):
            raise HTTPException(status_code=422, detail=f"{name} possui formato inválido")
        if any(len(item) > _TEXT_LIMIT for item in value):
            raise HTTPException(status_code=422, detail=f"{name} excede o limite de tamanho")
    if name in {"p_limit", "p_limite", "p_offset", "p_dias_min", "p_dias_max", "p_dias_limite", "p_cutoff_anos", "p_ano"}:
        if not isinstance(value, int) or isinstance(value, bool):
            raise HTTPException(status_code=422, detail=f"{name} precisa ser inteiro")
        if name in {"p_limit", "p_limite", "p_dias_limite", "p_cutoff_anos"} and not 1 <= value <= 5000:
            raise HTTPException(status_code=422, detail=f"{name} fora do limite permitido")
        if name in {"p_offset", "p_dias_min", "p_dias_max", "p_ano"} and value < 0:
            raise HTTPException(status_code=422, detail=f"{name} não pode ser negativo")
    return value


def build_args(rpc_name: str, params: dict[str, Any]) -> tuple[RpcSpec, tuple[Any, ...]]:
    spec = get_spec(rpc_name)
    unknown = set(params) - set(spec.args)
    if unknown:
        raise HTTPException(status_code=422, detail="Parâmetro BI não permitido")
    for required in spec.required:
        if params.get(required) is None:
            raise HTTPException(status_code=422, detail=f"{required} é obrigatório")
    validated = {key: _validate_value(key, value) for key, value in params.items()}
    if validated.get("p_from") and validated.get("p_to") and validated["p_from"] > validated["p_to"]:
        raise HTTPException(status_code=422, detail="p_from não pode ser posterior a p_to")
    return spec, tuple(validated.get(key) for key in spec.args)
