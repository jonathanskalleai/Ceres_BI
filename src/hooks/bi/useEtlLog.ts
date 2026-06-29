import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EtlRunLog } from "@/types/biRpc";

async function fetchEtlLog(tableName: string | null): Promise<EtlRunLog[]> {
  const { data, error } = await supabase.rpc("rpc_etl_log", {
    p_table_name: tableName,
    p_limit: 48,
  });

  if (error) throw new Error(error.message);

  // RPC returns json — may come as raw array or wrapped
  const parsed = Array.isArray(data) ? data : (data as unknown as EtlRunLog[]);
  return parsed ?? [];
}

/**
 * Hook for rpc_etl_log — run history (last 48 runs) for a given mirror view.
 * Lazy: pass `enabled = false` until the row is expanded, so the fetch only
 * fires on first expand. Refetches every 60s while expanded.
 */
export function useEtlLog(tableName: string | null, enabled: boolean) {
  const query = useQuery<EtlRunLog[], Error>({
    queryKey: ["rpc", "etl-log", tableName],
    queryFn: () => fetchEtlLog(tableName),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return {
    runs: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
