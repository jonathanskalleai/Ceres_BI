import { supabase } from "@/integrations/supabase/client";
import type {
  RpcKpisComercial,
  RpcRankingVendedor,
  RpcEvolucaoMensal,
  RpcRankingRegiao,
  RpcClienteVendedor,
  RpcRankingVendedorV2,
  RpcRegistroRecente,
} from "@/types/comercialRpc";

/**
 * Calls rpc_kpis_comercial — returns aggregated KPIs as a single JSON object.
 */
export async function fetchKpisComercial(
  from: string,
  to: string,
  vendedor?: string,
): Promise<RpcKpisComercial> {
  try {
    const params: Record<string, unknown> = { p_from: from, p_to: to };
    if (vendedor) params.p_vendedor = vendedor;

    const { data, error } = await supabase.rpc("rpc_kpis_comercial", params);
    if (error) throw new Error(error.message);

    const raw = Array.isArray(data) ? data[0] : data;
    return raw as RpcKpisComercial;
  } catch (err) {
    throw new Error(`[comercialRpcService.fetchKpisComercial] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_ranking_vendedores — returns sorted list of top sellers.
 */
export async function fetchRankingVendedores(
  from: string,
  to: string,
  limit?: number,
): Promise<RpcRankingVendedor[]> {
  try {
    const params: Record<string, unknown> = { p_from: from, p_to: to };
    if (limit != null) params.p_limit = limit;

    const { data, error } = await supabase.rpc("rpc_ranking_vendedores", params);
    if (error) throw new Error(error.message);
    return (data ?? []) as RpcRankingVendedor[];
  } catch (err) {
    throw new Error(`[comercialRpcService.fetchRankingVendedores] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_evolucao_mensal — monthly evolution of key metrics.
 */
export async function fetchEvolucaoMensal(
  from: string,
  to: string,
  vendedor?: string,
): Promise<RpcEvolucaoMensal[]> {
  try {
    const params: Record<string, unknown> = { p_from: from, p_to: to };
    if (vendedor) params.p_vendedor = vendedor;

    const { data, error } = await supabase.rpc("rpc_evolucao_mensal", params);
    if (error) throw new Error(error.message);
    return (data ?? []) as RpcEvolucaoMensal[];
  } catch (err) {
    throw new Error(`[comercialRpcService.fetchEvolucaoMensal] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_ranking_regioes — top cities by activity.
 */
export async function fetchRankingRegioes(
  from: string,
  to: string,
  limit?: number,
): Promise<RpcRankingRegiao[]> {
  try {
    const params: Record<string, unknown> = { p_from: from, p_to: to };
    if (limit != null) params.p_limit = limit;

    const { data, error } = await supabase.rpc("rpc_ranking_regioes", params);
    if (error) throw new Error(error.message);
    return (data ?? []) as RpcRankingRegiao[];
  } catch (err) {
    throw new Error(`[comercialRpcService.fetchRankingRegioes] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_clientes_por_vendedor — clients served by a specific seller.
 */
export async function fetchClientesPorVendedor(
  vendedor: string,
  from: string,
  to: string,
): Promise<RpcClienteVendedor[]> {
  try {
    const { data, error } = await supabase.rpc("rpc_clientes_por_vendedor", {
      p_vendedor: vendedor,
      p_from: from,
      p_to: to,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as RpcClienteVendedor[];
  } catch (err) {
    throw new Error(`[comercialRpcService.fetchClientesPorVendedor] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_ranking_vendedores_v2 — expanded ranking with negocios, conversao, crm_quality.
 */
export async function fetchRankingVendedoresV2(
  from: string,
  to: string,
  limit?: number,
): Promise<RpcRankingVendedorV2[]> {
  try {
    const params: Record<string, unknown> = { p_from: from, p_to: to };
    if (limit != null) params.p_limit = limit;

    const { data, error } = await supabase.rpc("rpc_ranking_vendedores_v2", params);
    if (error) throw new Error(error.message);
    return (data ?? []) as RpcRankingVendedorV2[];
  } catch (err) {
    throw new Error(`[comercialRpcService.fetchRankingVendedoresV2] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_registros_recentes — recent CRM actions with optional filters.
 */
export async function fetchRegistrosRecentes(
  from: string,
  to: string,
  vendedor?: string,
  cidade?: string,
  limit?: number,
): Promise<RpcRegistroRecente[]> {
  try {
    const params: Record<string, unknown> = {
      p_from: from || null,
      p_to: to || null,
    };
    if (vendedor) params.p_vendedor = vendedor;
    if (cidade) params.p_cidade = cidade;
    if (limit != null) params.p_limit = limit;

    const { data, error } = await supabase.rpc("rpc_registros_recentes", params);
    if (error) throw new Error(error.message);
    return (data ?? []) as RpcRegistroRecente[];
  } catch (err) {
    throw new Error(`[comercialRpcService.fetchRegistrosRecentes] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}
