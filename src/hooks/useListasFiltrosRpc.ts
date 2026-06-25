import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchListasFiltros, type ListasFiltrosResult } from "@/services/listasFiltrosRpcService";

const STALE_TIME = 5 * 60_000; // 5 minutes

interface UseListasFiltrosRpcOptions {
  from: string;
  to: string;
  enabled?: boolean;
}

/**
 * Fetches distinct vendedores and cidades for BI filter dropdowns.
 * Backed by rpc_listas_filtros — server-side, no client-side aggregation.
 */
export function useListasFiltrosRpc({ from, to, enabled = true }: UseListasFiltrosRpcOptions) {
  return useQuery<ListasFiltrosResult, Error>({
    queryKey: ["rpc", "listas-filtros", from, to],
    queryFn: () => fetchListasFiltros(from, to),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: enabled && !!from && !!to,
  });
}
