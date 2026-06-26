import { supabase } from "@/integrations/supabase/client";

export interface ListasFiltrosResult {
  vendedores: string[];
  cidades: string[];
}

/**
 * Calls rpc_listas_filtros — returns distinct vendedores and cidades
 * for the BI filter dropdowns within a date range.
 */
export async function fetchListasFiltros(
  from: string,
  to: string,
): Promise<ListasFiltrosResult> {
  try {
    const { data, error } = await supabase.rpc("rpc_listas_filtros", {
      p_from: from,
      p_to: to,
    });
    if (error) throw new Error(error.message);

    // RPC returns a single JSON object
    const raw = Array.isArray(data) ? data[0] : data;
    return (raw ?? { vendedores: [], cidades: [] }) as ListasFiltrosResult;
  } catch (err) {
    throw new Error(`[listasFiltrosRpcService.fetchListasFiltros] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}
