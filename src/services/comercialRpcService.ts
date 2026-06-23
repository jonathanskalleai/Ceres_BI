import { supabase } from "@/integrations/supabase/client";
import type {
  RpcKpisComercial,
  RpcRankingVendedor,
  RpcEvolucaoMensal,
  RpcRankingRegiao,
  RpcClienteVendedor,
} from "@/types/comercialRpc";

/**
 * Calls rpc_kpis_comercial — returns aggregated KPIs as a single JSON object.
 */
export async function fetchKpisComercial(
  from: string,
  to: string,
  vendedor?: string,
): Promise<RpcKpisComercial> {
  const params: Record<string, unknown> = { p_from: from, p_to: to };
  if (vendedor) params.p_vendedor = vendedor;

  const { data, error } = await supabase.rpc("rpc_kpis_comercial", params);
  if (error) throw new Error(`rpc_kpis_comercial: ${error.message}`);

  // The RPC returns a single JSON value; Supabase client may wrap it in an array
  // depending on the return type definition. Normalize:
  const raw = Array.isArray(data) ? data[0] : data;
  return raw as RpcKpisComercial;
}

/**
 * Calls rpc_ranking_vendedores — returns sorted list of top sellers.
 */
export async function fetchRankingVendedores(
  from: string,
  to: string,
  limit?: number,
): Promise<RpcRankingVendedor[]> {
  const params: Record<string, unknown> = { p_from: from, p_to: to };
  if (limit != null) params.p_limit = limit;

  const { data, error } = await supabase.rpc("rpc_ranking_vendedores", params);
  if (error) throw new Error(`rpc_ranking_vendedores: ${error.message}`);
  return (data ?? []) as RpcRankingVendedor[];
}

/**
 * Calls rpc_evolucao_mensal — monthly evolution of key metrics.
 */
export async function fetchEvolucaoMensal(
  from: string,
  to: string,
  vendedor?: string,
): Promise<RpcEvolucaoMensal[]> {
  const params: Record<string, unknown> = { p_from: from, p_to: to };
  if (vendedor) params.p_vendedor = vendedor;

  const { data, error } = await supabase.rpc("rpc_evolucao_mensal", params);
  if (error) throw new Error(`rpc_evolucao_mensal: ${error.message}`);
  return (data ?? []) as RpcEvolucaoMensal[];
}

/**
 * Calls rpc_ranking_regioes — top cities by activity.
 */
export async function fetchRankingRegioes(
  from: string,
  to: string,
  limit?: number,
): Promise<RpcRankingRegiao[]> {
  const params: Record<string, unknown> = { p_from: from, p_to: to };
  if (limit != null) params.p_limit = limit;

  const { data, error } = await supabase.rpc("rpc_ranking_regioes", params);
  if (error) throw new Error(`rpc_ranking_regioes: ${error.message}`);
  return (data ?? []) as RpcRankingRegiao[];
}

/**
 * Calls rpc_clientes_por_vendedor — clients served by a specific seller.
 */
export async function fetchClientesPorVendedor(
  vendedor: string,
  from: string,
  to: string,
): Promise<RpcClienteVendedor[]> {
  const { data, error } = await supabase.rpc("rpc_clientes_por_vendedor", {
    p_vendedor: vendedor,
    p_from: from,
    p_to: to,
  });
  if (error) throw new Error(`rpc_clientes_por_vendedor: ${error.message}`);
  return (data ?? []) as RpcClienteVendedor[];
}
