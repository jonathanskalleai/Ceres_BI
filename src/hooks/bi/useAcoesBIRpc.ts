import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchAcoesRuntime } from "@/services/bi/acoesRuntimeService";
import { isBiAbortError } from "@/lib/bi/runtime";
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
    queryFn: ({ signal }) => fetchAcoesRuntime({ from, to, vendedor, tipoAcao, cidade, signal }),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
    retry: (failureCount, error) => failureCount < 1 && !isBiAbortError(error) && error.name !== "BiContractError",
    // The Ações section is wrapped by WidgetErrorBoundary. A malformed
    // contract must reach that boundary instead of becoming `data ?? EMPTY`
    // and being shown as a page full of zeros.
    throwOnError: (error) => error.name === "BiContractError",
  });
}
