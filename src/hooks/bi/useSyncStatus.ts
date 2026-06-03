import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SyncStatus {
  lastSyncAt: Date | null;
  isStale: boolean;
}

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutos

async function fetchSyncMetadata(): Promise<SyncStatus> {
  const { data, error } = await supabase
    .schema("mirror")
    .from("sync_metadata")
    .select("last_sync_at")
    .order("last_sync_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return { lastSyncAt: null, isStale: true };
  }

  const lastSyncAt = new Date(data.last_sync_at as string);
  const isStale = Date.now() - lastSyncAt.getTime() > STALE_THRESHOLD_MS;

  return { lastSyncAt, isStale };
}

export function useSyncStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ["mirror-sync-status"],
    queryFn: fetchSyncMetadata,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  return {
    lastSyncAt: data?.lastSyncAt ?? null,
    isStale: data?.isStale ?? false,
    isLoading,
  };
}
