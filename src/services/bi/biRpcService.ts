import { supabase } from "@/integrations/supabase/client";
import type { RpcNegociosBI, RpcPedidosBI, RpcServicosBI, RpcAdminBI, RpcAcoesBI } from "@/types/biRpc";

/**
 * Calls rpc_negocios_bi — returns aggregated business deal metrics as JSON.
 */
export async function fetchNegociosBI(
  from: string,
  to: string,
  funis?: string[],
): Promise<RpcNegociosBI> {
  const params: Record<string, unknown> = { p_from: from, p_to: to };
  if (funis && funis.length > 0) params.p_funis = funis;

  const { data, error } = await supabase.rpc("rpc_negocios_bi", params);
  if (error) throw new Error(`rpc_negocios_bi: ${error.message}`);

  // RPC returns single JSON value; Supabase may wrap in array
  const raw = Array.isArray(data) ? data[0] : data;
  return raw as RpcNegociosBI;
}

/**
 * Calls rpc_pedidos_bi — returns aggregated order metrics as JSON.
 */
export async function fetchPedidosBI(
  from: string,
  to: string,
): Promise<RpcPedidosBI> {
  const { data, error } = await supabase.rpc("rpc_pedidos_bi", {
    p_from: from,
    p_to: to,
  });
  if (error) throw new Error(`rpc_pedidos_bi: ${error.message}`);

  const raw = Array.isArray(data) ? data[0] : data;
  return raw as RpcPedidosBI;
}

/**
 * Calls rpc_servicos_bi — returns aggregated OS metrics as JSON.
 */
export async function fetchServicosBI(
  from: string,
  to: string,
): Promise<RpcServicosBI> {
  const { data, error } = await supabase.rpc("rpc_servicos_bi", {
    p_from: from,
    p_to: to,
  });
  if (error) throw new Error(`rpc_servicos_bi: ${error.message}`);

  const raw = Array.isArray(data) ? data[0] : data;
  return raw as RpcServicosBI;
}

/**
 * Calls rpc_admin_bi — returns aggregated carteira/client metrics as JSON.
 * No params (static table, no date filter).
 */
export async function fetchAdminBI(): Promise<RpcAdminBI> {
  const { data, error } = await supabase.rpc("rpc_admin_bi");
  if (error) throw new Error(`rpc_admin_bi: ${error.message}`);

  const raw = Array.isArray(data) ? data[0] : data;
  return raw as RpcAdminBI;
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
  const rpcParams: Record<string, unknown> = {};
  if (params.from) rpcParams.p_from = params.from;
  if (params.to) rpcParams.p_to = params.to;
  if (params.vendedor) rpcParams.p_vendedor = params.vendedor;
  if (params.tipoAcao) rpcParams.p_tipo_acao = params.tipoAcao;
  if (params.cidade) rpcParams.p_cidade = params.cidade;

  const { data, error } = await supabase.rpc("rpc_acoes_bi", rpcParams);
  if (error) throw new Error(`rpc_acoes_bi: ${error.message}`);

  const raw = Array.isArray(data) ? data[0] : data;
  return raw as RpcAcoesBI;
}
