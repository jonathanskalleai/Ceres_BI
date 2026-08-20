import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchNegociosExpandido } from "@/services/bi/negociosExpandidoService";
import type { NegociosExpandidoResponse } from "@/types/bi/negociosExpandido";

const STALE_TIME = 5 * 60_000; // 5 minutes

interface UseNegociosExpandidoRpcOptions {
  pFrom: string;
  pTo: string;
  pVendedor?: string;
  pCidade?: string;
  active?: boolean;
}

/**
 * Hook para rpc_negocios_bi_expandido — 15 blocos de agregacao server-side.
 * Só executa enquanto a aba estiver ativa (active=true).
 */
export function useNegociosExpandidoRpc({
  pFrom,
  pTo,
  pVendedor,
  pCidade,
  active = true,
}: UseNegociosExpandidoRpcOptions) {
  return useQuery<NegociosExpandidoResponse, Error>({
    queryKey: [
      "rpc",
      "negocios-bi-expandido",
      pFrom,
      pTo,
      pVendedor ?? null,
      pCidade ?? null,
    ],
    queryFn: () =>
      fetchNegociosExpandido({ pFrom, pTo, pVendedor, pCidade }),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: active && !!pFrom && !!pTo,
  });
}
