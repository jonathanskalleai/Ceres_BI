import { supabase } from "@/integrations/supabase/client";
import type {
  RpcNegociosBI,
  RpcPedidosBI,
  PedidosGrupoProdutoItem,
  PedidosMarcaProdutoItem,
  RpcServicosBI,
  RpcAdminBI,
  RpcAcoesBI,
  RpcAcoesDetalhe,
  RpcClientesRisco,
  RpcInteligenciaEsforcoBI,
  RpcParqueRenovacaoBI,
  RpcOperacionalBI,
  RpcProdutosBI,
  AcoesBIEvolucaoMensalAnoCorrente,
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
 * Defensive defaults — prevents crash when RPC returns partial object (missing CTEs).
 * Exported so the section component reuses it as its empty-state baseline (DRY).
 */
export const PEDIDOS_BI_DEFAULTS: RpcPedidosBI = {
  kpis: { total: 0, faturamento: 0, ticketMedio: 0, percentAprovado: 0, percentFinanciado: 0, valorCancelado: 0 },
  evolucaoMensal: [],
  porSituacao: [],
  mixPagamento: [],
  porVendedor: [],
  porCidade: [],
  porGrupoProduto: [],
  porMarcaProduto: [],
};

/**
 * Calls rpc_pedidos_bi — returns aggregated order metrics as JSON.
 *
 * The deployed RPC still emits `grupoProduto`/`marcaProduto` (no `por` prefix);
 * the canonical contract is `porGrupoProduto`/`porMarcaProduto`. We accept both
 * here so the product charts render now and stay correct after the DB redeploy.
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
    const raw = unwrapRpc<
      Partial<RpcPedidosBI> & {
        grupoProduto?: PedidosGrupoProdutoItem[];
        marcaProduto?: PedidosMarcaProdutoItem[];
      }
    >(data);
    return {
      ...PEDIDOS_BI_DEFAULTS,
      ...raw,
      kpis: { ...PEDIDOS_BI_DEFAULTS.kpis, ...raw.kpis },
      porGrupoProduto: raw.porGrupoProduto ?? raw.grupoProduto ?? [],
      porMarcaProduto: raw.porMarcaProduto ?? raw.marcaProduto ?? [],
    };
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
 * Calls rpc_acoes_bi_periodo — returns action metrics with every visual
 * aggregate constrained to the selected calendar interval.
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

    const { data, error } = await supabase.rpc("rpc_acoes_bi_periodo", rpcParams);
    if (error) throw new Error(error.message);
    return unwrapRpc<RpcAcoesBI>(data);
  } catch (err) {
    throw new Error(`[biRpcService.fetchAcoesBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_acoes_visitas_mensal — serie de visitas por mes, no mesmo recorte
 * de filtros de /bi/acoes. Separada do agregado principal para manter o
 * contrato existente de rpc_acoes_bi estavel.
 */
export async function fetchAcoesVisitasMensal(params: {
  from?: string;
  to?: string;
  vendedor?: string;
  tipoAcao?: string;
  cidade?: string;
}): Promise<{ name: string; visitas: number }[]> {
  try {
    const rpcParams: Record<string, unknown> = {};
    if (params.from) rpcParams.p_from = params.from;
    if (params.to) rpcParams.p_to = params.to;
    if (params.vendedor) rpcParams.p_vendedor = params.vendedor;
    if (params.tipoAcao) rpcParams.p_tipo_acao = params.tipoAcao;
    if (params.cidade) rpcParams.p_cidade = params.cidade;

    const { data, error } = await supabase.rpc("rpc_acoes_visitas_mensal", rpcParams);
    if (error) throw new Error(error.message);
    // Esta RPC RETORNA um JSON array. Ao contrario das RPCs que retornam um
    // objeto JSON, nao podemos usar `unwrapRpc`: ele pegaria apenas o primeiro
    // mes e entregaria um objeto onde o grafico espera uma lista.
    return Array.isArray(data) ? data as { name: string; visitas: number }[] : [];
  } catch (err) {
    throw new Error(`[biRpcService.fetchAcoesVisitasMensal] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_acoes_evolucao_mensal_ano_corrente. The two evolution charts in
 * /bi/acoes intentionally always span January through the current month;
 * unlike the remaining visuals, the calendar period does not constrain them.
 */
export async function fetchAcoesEvolucaoMensalAnoCorrente(params: {
  vendedor?: string;
  tipoAcao?: string;
  cidade?: string;
}): Promise<AcoesBIEvolucaoMensalAnoCorrente[]> {
  try {
    const rpcParams: Record<string, unknown> = {};
    if (params.vendedor) rpcParams.p_vendedor = params.vendedor;
    if (params.tipoAcao) rpcParams.p_tipo_acao = params.tipoAcao;
    if (params.cidade) rpcParams.p_cidade = params.cidade;

    const { data, error } = await supabase.rpc("rpc_acoes_evolucao_mensal_ano_corrente", rpcParams);
    if (error) throw new Error(error.message);
    // Esta RPC retorna diretamente uma lista JSON, sem o wrapper de objeto
    // usado pelas demais agregacoes de BI.
    return Array.isArray(data) ? data as AcoesBIEvolucaoMensalAnoCorrente[] : [];
  } catch (err) {
    throw new Error(`[biRpcService.fetchAcoesEvolucaoMensalAnoCorrente] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_acoes_detalhe — paginated detail rows for the "Acoes do Periodo" table.
 *
 * Separada de `fetchAcoesBI` de proposito: `rpc_acoes_bi` roda 4x no app (2x em
 * AcoesSection para o comparativo de trend + 2x em usePainelKPIsRpc, que le SOMENTE
 * `kpis`). Manter ~660 linhas com observacao no payload monolitico faria esse peso
 * viajar 4 vezes, 2 delas para uma tela que nem renderiza tabela.
 */
export async function fetchAcoesDetalhe(params: {
  from?: string;
  to?: string;
  vendedor?: string;
  tipoAcao?: string;
  cidade?: string;
  statusNegocio?: string;
  limit?: number;
  offset?: number;
}): Promise<RpcAcoesDetalhe> {
  try {
    const rpcParams: Record<string, unknown> = {};
    if (params.from) rpcParams.p_from = params.from;
    if (params.to) rpcParams.p_to = params.to;
    if (params.vendedor) rpcParams.p_vendedor = params.vendedor;
    if (params.tipoAcao) rpcParams.p_tipo_acao = params.tipoAcao;
    if (params.cidade) rpcParams.p_cidade = params.cidade;
    if (params.statusNegocio) rpcParams.p_status = params.statusNegocio;
    if (params.limit != null) rpcParams.p_limit = params.limit;
    if (params.offset != null) rpcParams.p_offset = params.offset;

    const { data, error } = await supabase.rpc("rpc_acoes_detalhe", rpcParams);
    if (error) throw new Error(error.message);

    const raw = unwrapRpc<Partial<RpcAcoesDetalhe> | null>(data);
    // Defensivo: RPC pode retornar null/objeto parcial se a funcao for redeployada
    return { rows: raw?.rows ?? [], total: raw?.total ?? 0 };
  } catch (err) {
    throw new Error(`[biRpcService.fetchAcoesDetalhe] ${err instanceof Error ? err.message : "Unknown error"}`);
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

/**
 * Calls rpc_acoes_clientes_risco — returns client risk distribution by days-since-last-action.
 */
export async function fetchClientesRisco(params: {
  vendedor?: string;
  cidade?: string;
}): Promise<RpcClientesRisco> {
  try {
    const rpcParams: Record<string, unknown> = {};
    if (params.vendedor) rpcParams.p_vendedor = params.vendedor;
    if (params.cidade) rpcParams.p_cidade = params.cidade;

    const { data, error } = await supabase.rpc("rpc_acoes_clientes_risco", rpcParams);
    if (error) throw new Error(error.message);

    const raw = unwrapRpc<Partial<RpcClientesRisco> | null>(data);
    return {
      faixas: raw?.faixas ?? [],
      totalCarteira: raw?.totalCarteira ?? 0,
      clientesComAcao: raw?.clientesComAcao ?? 0,
      clientesSemAcao: raw?.clientesSemAcao ?? 0,
    };
  } catch (err) {
    throw new Error(`[biRpcService.fetchClientesRisco] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}
