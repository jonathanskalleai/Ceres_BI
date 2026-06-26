import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchServicosBI } from "@/services/bi/biRpcService";
import type { RpcServicosBI } from "@/types/biRpc";

const STALE_TIME = 5 * 60_000; // 5 minutes

interface UseServicosBIOptions {
  from: string;
  to: string;
  cidade?: string;
  enabled?: boolean;
}

/**
 * Hook for rpc_servicos_bi — server-side aggregation of OS metrics.
 * Returns KPIs, status breakdown, resolution bands, and monthly evolution.
 */
export function useServicosBIRpc({
  from,
  to,
  cidade,
  enabled = true,
}: UseServicosBIOptions) {
  return useQuery<RpcServicosBI, Error>({
    queryKey: ["rpc", "servicos-bi", from, to, cidade ?? null],
    queryFn: () => fetchServicosBI(from, to, cidade),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: enabled && !!from && !!to,
  });
}
