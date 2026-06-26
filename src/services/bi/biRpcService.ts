import { supabase } from "@/integrations/supabase/client";
import type {
  RpcNegociosBI,
  RpcPedidosBI,
  RpcServicosBI,
  RpcAdminBI,
  RpcAcoesBI,
  RpcInteligenciaEsforcoBI,
  RpcParqueRenovacaoBI,
  RpcOperacionalBI,
  RpcProdutosBI,
} from "@/types/biRpc";

/** Unwrap Supabase RPC response — single-JSON RPCs may return wrapped in array. */
function unwrapRpc<T>(data: unknown): T {
  const raw = Array.isArray(data) ? data[0] : data;
  return raw as T;
}

/** Defensive defaults — prevents crash when RPC returns partial object (missing CTEs). */
const NEGOCIOS_BI_DEFAULTS: RpcNegociosBI = {
  kpis: {
    totalNegocios: 0,
    ganhos: 0,
    perdidos: 0,
    andamento: 0,
    taxaConversao: 0,
    pipelineAberto: 0,
    pipelinePerdido: 0,
    valorGanho: 0,
    ticketMedioGanho: 0,
    cicloMedioDias: 0,
    esforcoMedio: 0,
  },
  funilPorEtapa: [],
  porOrigem: [],
  motivosPerda: [],
  evolucaoMensal: [],
  rankingConsultor: [],
  velocidadeFunil: [],
  duracaoMediaTotal: 0,
};

/**
 * Calls rpc_negocios_bi — returns aggregated business deal metrics as JSON.
 */
export async function fetchNegociosBI(
  from: string,
  to: string,
  funis?: string[],
  vendedor?: string,
  cidade?: string,
): Promise<RpcNegociosBI> {
  try {
    const params: Record<string, unknown> = { p_from: from, p_to: to };
    if (funis && funis.length > 0) params.p_funis = funis;
    if (vendedor) params.p_vendedor = vendedor;
    if (cidade) params.p_cidade = cidade;

    const { data, error } = await supabase.rpc("rpc_negocios_bi", params);
    if (error) throw new Error(error.message);
    const raw = unwrapRpc<Partial<RpcNegociosBI>>(data);
    return {
      ...NEGOCIOS_BI_DEFAULTS,
      ...raw,
      kpis: { ...NEGOCIOS_BI_DEFAULTS.kpis, ...raw.kpis },
    };
  } catch (err) {
    throw new Error(`[biRpcService.fetchNegociosBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_pedidos_bi — returns aggregated order metrics as JSON.
 */
export async function fetchPedidosBI(
  from: string,
  to: string,
  vendedor?: string,
  cidade?: string,
): Promise<RpcPedidosBI> {
  try {
    const params: Record<string, unknown> = { p_from: from, p_to: to };
    if (vendedor) params.p_vendedor = vendedor;
    if (cidade) params.p_cidade = cidade;

    const { data, error } = await supabase.rpc("rpc_pedidos_bi", params);
    if (error) throw new Error(error.message);
    return unwrapRpc<RpcPedidosBI>(data);
  } catch (err) {
    throw new Error(`[biRpcService.fetchPedidosBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_servicos_bi — returns aggregated OS metrics as JSON.
 */
export async function fetchServicosBI(
  from: string,
  to: string,
  cidade?: string,
): Promise<RpcServicosBI> {
  try {
    const params: Record<string, unknown> = { p_from: from, p_to: to };
    if (cidade) params.p_cidade = cidade;

    const { data, error } = await supabase.rpc("rpc_servicos_bi", params);
    if (error) throw new Error(error.message);
    return unwrapRpc<RpcServicosBI>(data);
  } catch (err) {
    throw new Error(`[biRpcService.fetchServicosBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_admin_bi — returns aggregated carteira/client metrics as JSON.
 * Optional cidade filter (snapshot table, no date filter).
 */
export async function fetchAdminBI(cidade?: string): Promise<RpcAdminBI> {
  try {
    const params: Record<string, unknown> = {};
    if (cidade) params.p_cidade = cidade;

    const { data, error } = await supabase.rpc("rpc_admin_bi", params);
    if (error) throw new Error(error.message);
    return unwrapRpc<RpcAdminBI>(data);
  } catch (err) {
    throw new Error(`[biRpcService.fetchAdminBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_acoes_bi — returns aggregated action metrics as JSON.
 */
export async function fetchAcoesBI(params: {
  from?: string;
  to?: string;
  vendedor?: string;
  tipoAcao?: string;
  cidade?: string;
}): Promise<RpcAcoesBI> {
  try {
    const rpcParams: Record<string, unknown> = {};
    if (params.from) rpcParams.p_from = params.from;
    if (params.to) rpcParams.p_to = params.to;
    if (params.vendedor) rpcParams.p_vendedor = params.vendedor;
    if (params.tipoAcao) rpcParams.p_tipo_acao = params.tipoAcao;
    if (params.cidade) rpcParams.p_cidade = params.cidade;

    const { data, error } = await supabase.rpc("rpc_acoes_bi", rpcParams);
    if (error) throw new Error(error.message);
    return unwrapRpc<RpcAcoesBI>(data);
  } catch (err) {
    throw new Error(`[biRpcService.fetchAcoesBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_inteligencia_esforco_bi — returns win rate + visitas/negocio metrics.
 */
export async function fetchInteligenciaEsforcoBI(
  from: string,
  to: string,
  funis?: string[] | null,
): Promise<RpcInteligenciaEsforcoBI> {
  try {
    const params: Record<string, unknown> = { p_from: from, p_to: to };
    if (funis && funis.length > 0) params.p_funis = funis;

    const { data, error } = await supabase.rpc("rpc_inteligencia_esforco_bi", params);
    if (error) throw new Error(error.message);
    return unwrapRpc<RpcInteligenciaEsforcoBI>(data);
  } catch (err) {
    throw new Error(`[biRpcService.fetchInteligenciaEsforcoBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_parque_renovacao_bi — returns fleet renewal opportunity by brand.
 */
export async function fetchParqueRenovacaoBI(
  cutoffAnos?: number,
): Promise<RpcParqueRenovacaoBI> {
  try {
    const { data, error } = await supabase.rpc("rpc_parque_renovacao_bi", {
      p_cutoff_anos: cutoffAnos ?? 5,
    });
    if (error) throw new Error(error.message);
    return unwrapRpc<RpcParqueRenovacaoBI>(data);
  } catch (err) {
    throw new Error(`[biRpcService.fetchParqueRenovacaoBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_operacional_bi — returns aggregated technician productivity metrics.
 */
export async function fetchOperacionalBI(): Promise<RpcOperacionalBI> {
  try {
    const { data, error } = await supabase.rpc("rpc_operacional_bi");
    if (error) throw new Error(error.message);
    return unwrapRpc<RpcOperacionalBI>(data);
  } catch (err) {
    throw new Error(`[biRpcService.fetchOperacionalBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_produtos_bi — returns aggregated installed base (parque) metrics.
 */
export async function fetchProdutosBI(): Promise<RpcProdutosBI> {
  try {
    const { data, error } = await supabase.rpc("rpc_produtos_bi");
    if (error) throw new Error(error.message);
    return unwrapRpc<RpcProdutosBI>(data);
  } catch (err) {
    throw new Error(`[biRpcService.fetchProdutosBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}
