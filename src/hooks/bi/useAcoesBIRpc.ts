import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchAcoesBI } from "@/services/bi/biRpcService";
import type { RpcAcoesBI } from "@/types/biRpc";

const STALE_TIME = 5 * 60_000; // 5 minutes

interface UseAcoesBIOptions {
  from?: string;
  to?: string;
  vendedor?: string;
  tipoAcao?: string;
  cidade?: string;
  enabled?: boolean;
}

/**
 * Hook for rpc_acoes_bi — server-side aggregation of action metrics.
 * All filters are optional and pushed to the server.
 */
export function useAcoesBIRpc({
  from,
  to,
  vendedor,
  tipoAcao,
  cidade,
  enabled = true,
}: UseAcoesBIOptions) {
  return useQuery<RpcAcoesBI, Error>({
    queryKey: ["rpc", "acoes-bi", from ?? null, to ?? null, vendedor ?? null, tipoAcao ?? null, cidade ?? null],
    queryFn: () => fetchAcoesBI({ from, to, vendedor, tipoAcao, cidade }),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}
