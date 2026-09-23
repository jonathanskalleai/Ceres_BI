import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchAcoesFunilPeriodoRuntime } from "@/services/bi/acoesRuntimeService";
import { shouldRetryAcoesQuery, biQueryRetryDelay } from "@/lib/bi/queryRetry";
import type { RpcAcoesFunilGestao } from "@/types/biRpc";

const STALE_TIME = 5 * 60_000;

interface UseAcoesFunilPeriodoOptions {
  from?: string;
  to?: string;
  vendedor?: string;
  cidade?: string;
  enabled?: boolean;
}

/** Oportunidades por primeira entrada no funil VENDAS, exclusiva da tela /bi/acoes. */
export function useAcoesFunilPeriodoRpc({
  from,
  to,
  vendedor,
  cidade,
  enabled = true,
}: UseAcoesFunilPeriodoOptions) {
  return useQuery<RpcAcoesFunilGestao, Error>({
    queryKey: ["rpc", "acoes-funil-gestao-periodo", from ?? null, to ?? null, vendedor ?? null, cidade ?? null],
    queryFn: ({ signal }) => fetchAcoesFunilPeriodoRuntime({ from, to, vendedor, cidade, signal }),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
    retry: shouldRetryAcoesQuery,
    retryDelay: biQueryRetryDelay,
  });
}
