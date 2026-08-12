import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchAcoesMapaOportunidades } from "@/services/bi/acoesGestaoService";
import type { RpcAcoesMapaOportunidades } from "@/types/biRpc";

const STALE_TIME = 5 * 60_000; // 5 minutes

interface UseAcoesMapaOptions {
  vendedor?: string;
  cidade?: string;
  /** Período da primeira entrada no funil VENDAS que alimenta o mapa. */
  from?: string;
  to?: string;
  /**
   * Passe `false` enquanto o bloco estiver fechado para não carregar o mapa.
   */
  enabled?: boolean;
}

/**
 * Hook for rpc_acoes_mapa_oportunidades — coorte do funil do período.
 */
export function useAcoesMapaRpc({ vendedor, cidade, from, to, enabled = true }: UseAcoesMapaOptions) {
  return useQuery<RpcAcoesMapaOportunidades, Error>({
    queryKey: ["rpc", "acoes-mapa-oportunidades", vendedor ?? null, cidade ?? null, from ?? null, to ?? null],
    queryFn: () => fetchAcoesMapaOportunidades({ vendedor, cidade, from, to }),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}
