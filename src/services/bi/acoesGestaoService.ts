import { supabase } from "@/integrations/supabase/client";
import type {
  AcoesGestaoListaRow,
  AcoesGestaoListaTipo,
  AcoesGestaoListas,
  RpcAcoesFunilGestao,
  RpcAcoesMapaOportunidades,
} from "@/types/biRpc";

/**
 * Fetchers das 3 RPCs de gestao comercial de /bi/acoes.
 *
 * Arquivo SEPARADO de `biRpcService.ts` de proposito (E3): aquele ja tem 321
 * linhas e 11 hooks importadores — somar fetchers ali o levaria a ~390, colado
 * no hard gate de 400 (`coding-standards.md` #4), num no critico do BI inteiro.
 *
 * Contrato de erro identico ao de `biRpcService`: o catch RE-LANCA com prefixo
 * `[arquivo.funcao]`. Nao e catch silencioso — o erro sobe para o react-query,
 * que o entrega ao componente, que renderiza estado de erro EXPLICITO
 * (`BiTableCard`/`ChartCard`). Engolir aqui transformaria falha de consulta em
 * "nenhum registro no periodo", que num BI e pior do que nao mostrar nada.
 */

/** Unwrap Supabase RPC response — single-JSON RPCs may return wrapped in array. */
function unwrapRpc<T>(data: unknown): T {
  const raw = Array.isArray(data) ? data[0] : data;
  return raw as T;
}

const FUNIL_DEFAULTS: RpcAcoesFunilGestao = {
  funil: {
    visitas: 0,
    oportunidades: 0,
    valorOportunidades: 0,
    ganhos: 0,
    perdidos: 0,
    valorPerdido: 0,
    visitasPorOportunidade: null,
    oportPorFechamento: null,
  },
  rankingConsultores: [],
  diasParados: { mediana: null, media: null, negociosAbertos: 0 },
  meta: {
    acoesSemConsultor: 0,
    ganhosSemAtribuicao: 0,
    perdidosSemAtribuicao: 0,
    somaGanhosRanking: 0,
  },
};

/**
 * Calls rpc_acoes_funil_gestao — agregados do funil + ranking + dias parados.
 *
 * Os defaults sao defensivos contra RPC redeployada/parcial, MAS as razoes
 * default para `null` (nao 0): "sem denominador" e ausencia de dado.
 */
export async function fetchAcoesFunilGestao(params: {
  from?: string;
  to?: string;
  vendedor?: string;
  cidade?: string;
}): Promise<RpcAcoesFunilGestao> {
  try {
    const rpcParams: Record<string, unknown> = {};
    if (params.from) rpcParams.p_from = params.from;
    if (params.to) rpcParams.p_to = params.to;
    if (params.vendedor) rpcParams.p_vendedor = params.vendedor;
    if (params.cidade) rpcParams.p_cidade = params.cidade;

    const { data, error } = await supabase.rpc("rpc_acoes_funil_gestao", rpcParams);
    if (error) throw new Error(error.message);

    const raw = unwrapRpc<Partial<RpcAcoesFunilGestao> | null>(data);
    return {
      funil: { ...FUNIL_DEFAULTS.funil, ...raw?.funil },
      rankingConsultores: raw?.rankingConsultores ?? [],
      diasParados: { ...FUNIL_DEFAULTS.diasParados, ...raw?.diasParados },
      meta: { ...FUNIL_DEFAULTS.meta, ...raw?.meta },
    };
  } catch (err) {
    throw new Error(
      `[acoesGestaoService.fetchAcoesFunilGestao] ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  }
}

export interface FetchAcoesGestaoListasParams {
  tipo: AcoesGestaoListaTipo;
  from?: string;
  to?: string;
  vendedor?: string;
  cidade?: string;
  limit?: number;
  offset?: number;
  search?: string;
  /** Recorte da faixa clicada no chart "Clientes em Risco" (drill-down). */
  diasMin?: number;
  diasMax?: number;
}

/**
 * Calls rpc_acoes_gestao_listas — lista de clientes paginada server-side.
 *
 * `TRow` e escolhido pelo chamador conforme `tipo` (as 3 listas tem shapes
 * diferentes). O acoplamento tipo<->shape esta documentado em cada hook/bloco
 * que consome; nao ha `any` no caminho.
 */
export async function fetchAcoesGestaoListas<TRow extends AcoesGestaoListaRow>(
  params: FetchAcoesGestaoListasParams,
): Promise<AcoesGestaoListas<TRow>> {
  try {
    const rpcParams: Record<string, unknown> = { p_tipo: params.tipo };
    if (params.from) rpcParams.p_from = params.from;
    if (params.to) rpcParams.p_to = params.to;
    if (params.vendedor) rpcParams.p_vendedor = params.vendedor;
    if (params.cidade) rpcParams.p_cidade = params.cidade;
    if (params.limit != null) rpcParams.p_limit = params.limit;
    if (params.offset != null) rpcParams.p_offset = params.offset;
    if (params.search) rpcParams.p_search = params.search;
    if (params.diasMin != null) rpcParams.p_dias_min = params.diasMin;
    if (params.diasMax != null) rpcParams.p_dias_max = params.diasMax;

    const { data, error } = await supabase.rpc("rpc_acoes_gestao_listas", rpcParams);
    if (error) throw new Error(error.message);

    const raw = unwrapRpc<Partial<AcoesGestaoListas<TRow>> | null>(data);
    return {
      rows: raw?.rows ?? [],
      total: raw?.total ?? 0,
      meta: raw?.meta ?? { tipo: params.tipo },
    };
  } catch (err) {
    throw new Error(
      `[acoesGestaoService.fetchAcoesGestaoListas:${params.tipo}] ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  }
}

const MAPA_DEFAULTS: RpcAcoesMapaOportunidades = {
  pinos: [],
  total: 0,
  comCoordenada: 0,
  semCoordenada: 0,
  valorTotal: 0,
  valorNoMapa: 0,
  meta: { viaAcao: 0, viaCarteira: 0 },
};

/**
 * Calls rpc_acoes_mapa_oportunidades — pinos das oportunidades abertas.
 *
 * Dois modos (toggle no painel do mapa):
 * - Sem from/to → ESTOQUE: todas as oportunidades abertas (comportamento original)
 * - Com from/to → PERIODO: oportunidades que tiveram acao no periodo (filtro via JOIN)
 */
export async function fetchAcoesMapaOportunidades(params: {
  vendedor?: string;
  cidade?: string;
  from?: string;
  to?: string;
}): Promise<RpcAcoesMapaOportunidades> {
  try {
    const rpcParams: Record<string, unknown> = {};
    if (params.vendedor) rpcParams.p_vendedor = params.vendedor;
    if (params.cidade) rpcParams.p_cidade = params.cidade;
    if (params.from) rpcParams.p_from = params.from;
    if (params.to) rpcParams.p_to = params.to;

    const { data, error } = await supabase.rpc("rpc_acoes_mapa_oportunidades", rpcParams);
    if (error) throw new Error(error.message);

    const raw = unwrapRpc<Partial<RpcAcoesMapaOportunidades> | null>(data);
    return { ...MAPA_DEFAULTS, ...raw, meta: { ...MAPA_DEFAULTS.meta, ...raw?.meta } };
  } catch (err) {
    throw new Error(
      `[acoesGestaoService.fetchAcoesMapaOportunidades] ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  }
}
