import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchAcoesMapaOportunidades } from "@/services/bi/acoesGestaoService";
import type { RpcAcoesMapaOportunidades } from "@/types/biRpc";

const STALE_TIME = 5 * 60_000; // 5 minutes

interface UseAcoesMapaOptions {
  vendedor?: string;
  cidade?: string;
  /**
   * O bloco do mapa nasce COLAPSADO: passe `false` enquanto fechado. Sao ~2.240
   * pinos — buscar (e montar o Leaflet) junto com o resto da tela pesaria o
   * carregamento inteiro por um bloco que o usuario pode nunca abrir.
   */
  enabled?: boolean;
}

/**
 * Hook for rpc_acoes_mapa_oportunidades — pinos das oportunidades abertas.
 *
 * Sem parametro de data por decisao da RPC: o mapa e o ESTOQUE aberto, nao o
 * fluxo do periodo. A queryKey reflete exatamente isso (so vendedor/cidade).
 */
export function useAcoesMapaRpc({ vendedor, cidade, enabled = true }: UseAcoesMapaOptions) {
  return useQuery<RpcAcoesMapaOportunidades, Error>({
    queryKey: ["rpc", "acoes-mapa-oportunidades", vendedor ?? null, cidade ?? null],
    queryFn: () => fetchAcoesMapaOportunidades({ vendedor, cidade }),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}
