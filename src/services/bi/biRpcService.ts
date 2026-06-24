import { supabase } from "@/integrations/supabase/client";
import type { RpcNegociosBI, RpcPedidosBI } from "@/types/biRpc";

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
