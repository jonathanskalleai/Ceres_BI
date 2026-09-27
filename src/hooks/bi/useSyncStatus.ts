import { useQuery } from "@tanstack/react-query";
import { fetchBiApi } from "@/services/bi/biApiTransport";
import { logClientWarning } from "@/lib/logger";

interface SyncStatus {
  lastSyncAt: Date | null;
  isStale: boolean;
}

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutos

interface ModelStatusPayload {
  manifest?: Array<{ last_completed_at?: string | null }>;
}

async function fetchSyncMetadata(): Promise<SyncStatus> {
  try {
    const data = await fetchBiApi<ModelStatusPayload>("/model-status", {});
    const timestamps = (data.manifest ?? [])
      .map((item) => item.last_completed_at)
      .filter((value): value is string => Boolean(value));
    const latest = timestamps
      .map((value) => new Date(value))
      .filter((value) => !Number.isNaN(value.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    if (!latest) {
      return { lastSyncAt: null, isStale: true };
    }
    return {
      lastSyncAt: latest,
      isStale: Date.now() - latest.getTime() > STALE_THRESHOLD_MS,
    };
  } catch (error) {
    logClientWarning("bi.sync_status_failed", error instanceof Error ? error : new Error("Falha ao consultar status do ETL"));
    return { lastSyncAt: null, isStale: true };
  }
}

export function useSyncStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ["bi-model-status"],
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
