import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchAdminBI } from "@/services/bi/biRpcService";
import type { RpcAdminBI } from "@/types/biRpc";

const STALE_TIME = 10 * 60_000; // 10 minutes (static data)

interface UseAdminBIOptions {
  cidade?: string;
  enabled?: boolean;
}

/**
 * Hook for rpc_admin_bi — server-side aggregation of client portfolio metrics.
 * Optional cidade filter (carteira is a snapshot table, no date params).
 */
export function useAdminBIRpc({ cidade, enabled = true }: UseAdminBIOptions = {}) {
  return useQuery<RpcAdminBI, Error>({
    queryKey: ["rpc", "admin-bi", cidade ?? null],
    queryFn: () => fetchAdminBI(cidade),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}
