import { supabase } from "@/integrations/supabase/client";
import type { RpcNegociosCrmResult } from "@/types/negociosCrm";

/**
 * Calls rpc_negocios_crm — returns full negocios dashboard data as JSON.
 */
export async function fetchNegociosCrm(
  from: string,
  to: string,
  cidade?: string,
  vendedor?: string,
): Promise<RpcNegociosCrmResult> {
  const params: Record<string, unknown> = { p_from: from, p_to: to };
  if (cidade) params.p_cidade = cidade;
  if (vendedor) params.p_vendedor = vendedor;

  const { data, error } = await supabase.rpc("rpc_negocios_crm", params);
  if (error) throw new Error(`rpc_negocios_crm: ${error.message}`);

  // RPC returns a single JSON value; normalize if wrapped in array
  const raw = Array.isArray(data) ? data[0] : data;
  return raw as RpcNegociosCrmResult;
}
