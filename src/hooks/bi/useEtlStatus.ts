import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EtlSyncStatus } from "@/types/biRpc";

async function fetchEtlStatus(): Promise<EtlSyncStatus[]> {
  const { data, error } = await supabase.rpc("rpc_etl_status");

  if (error) throw new Error(error.message);

  // RPC returns json — may come as raw array or wrapped
  const parsed = Array.isArray(data) ? data : (data as unknown as EtlSyncStatus[]);
  return parsed ?? [];
}

/**
 * Hook for rpc_etl_status — reads from mirror.sync_metadata (joined with sync_log).
 * Shows ETL sync status for all Campus Dealer tables.
 * Refetches every 60s to keep freshness indicators live.
 */
export function useEtlStatus() {
  const query = useQuery<EtlSyncStatus[], Error>({
    queryKey: ["rpc", "etl-status"],
    queryFn: fetchEtlStatus,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  return {
    tables: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
