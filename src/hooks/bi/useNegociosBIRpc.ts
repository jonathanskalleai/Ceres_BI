import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchNegociosBI } from "@/services/bi/biRpcService";
import type { RpcNegociosBI } from "@/types/biRpc";

const STALE_TIME = 5 * 60_000; // 5 minutes

interface UseNegociosBIOptions {
  from: string;
  to: string;
  funis?: string[];
  enabled?: boolean;
}

/**
 * Hook for rpc_negocios_bi — server-side aggregation of deal metrics.
 * Returns KPIs, funnel breakdown, origin analysis, loss reasons,
 * monthly evolution, and consultant ranking.
 */
export function useNegociosBIRpc({
  from,
  to,
  funis,
  enabled = true,
}: UseNegociosBIOptions) {
  return useQuery<RpcNegociosBI, Error>({
    queryKey: ["rpc", "negocios-bi", from, to, funis ?? null],
    queryFn: () => fetchNegociosBI(from, to, funis),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: enabled && !!from && !!to,
  });
}
