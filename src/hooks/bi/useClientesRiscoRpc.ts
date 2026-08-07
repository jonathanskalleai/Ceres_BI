import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchClientesRisco } from "@/services/bi/biRpcService";
import type { RpcClientesRisco } from "@/types/biRpc";

const STALE_TIME = 5 * 60_000; // 5 minutes

interface UseClientesRiscoOptions {
  vendedor?: string;
  cidade?: string;
  enabled?: boolean;
}

/**
 * Hook for rpc_acoes_clientes_risco — client risk distribution by days since last action.
 * Filters: vendedor, cidade (pushed to server).
 */
export function useClientesRiscoRpc({
  vendedor,
  cidade,
  enabled = true,
}: UseClientesRiscoOptions) {
  return useQuery<RpcClientesRisco, Error>({
    queryKey: ["rpc", "clientes-risco", vendedor ?? null, cidade ?? null],
    queryFn: () => fetchClientesRisco({ vendedor, cidade }),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}
