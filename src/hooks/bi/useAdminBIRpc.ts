import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchAdminBI } from "@/services/bi/biRpcService";
import type { RpcAdminBI } from "@/types/biRpc";

const STALE_TIME = 10 * 60_000; // 10 minutes (static data)

interface UseAdminBIOptions {
  enabled?: boolean;
}

/**
 * Hook for rpc_admin_bi — server-side aggregation of client portfolio metrics.
 * No date params needed (carteira is a snapshot table).
 */
export function useAdminBIRpc({ enabled = true }: UseAdminBIOptions = {}) {
  return useQuery<RpcAdminBI, Error>({
    queryKey: ["rpc", "admin-bi"],
    queryFn: () => fetchAdminBI(),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}
