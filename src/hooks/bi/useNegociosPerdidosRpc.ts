import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchAcoesNegociosPerdidos } from "@/services/bi/acoesNegociosPerdidosService";
import type { RpcNegociosPerdidos } from "@/services/bi/acoesNegociosPerdidosService";

const STALE_TIME = 5 * 60_000; // 5 minutes

export const NEGOCIOS_PERDIDOS_PAGE_SIZE = 50;

interface UseNegociosPerdidosRpcOptions {
  from?: string;
  to?: string;
  vendedor?: string;
  cidade?: string;
  /** Pagina atual (1-based). Default 1. */
  page?: number;
  enabled?: boolean;
}

/**
 * Hook for rpc_acoes_negocios_perdidos — negócios perdidos no período (Story 4-B).
 *
 * Paginacao server-side: cada pagina faz um round-trip com LIMIT/OFFSET.
 * `keepPreviousData` evita flash ao trocar de pagina.
 */
export function useNegociosPerdidosRpc({
  from,
  to,
  vendedor,
  cidade,
  page = 1,
  enabled = true,
}: UseNegociosPerdidosRpcOptions) {
  const limit = NEGOCIOS_PERDIDOS_PAGE_SIZE;
  const offset = (page - 1) * NEGOCIOS_PERDIDOS_PAGE_SIZE;

  return useQuery<RpcNegociosPerdidos, Error>({
    queryKey: [
      "rpc", "acoes-negocios-perdidos",
      from ?? null, to ?? null, vendedor ?? null, cidade ?? null,
      page,
    ],
    queryFn: () => fetchAcoesNegociosPerdidos({ from, to, vendedor, cidade, limit, offset }),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}
