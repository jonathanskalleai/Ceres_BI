import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchAcoesMapaOportunidades } from "@/services/bi/acoesGestaoService";
import type { RpcAcoesMapaOportunidades } from "@/types/biRpc";

const STALE_TIME = 5 * 60_000; // 5 minutes

interface UseAcoesMapaOptions {
  vendedor?: string;
  cidade?: string;
  /** Quando preenchidos, filtra por oportunidades tocadas no periodo. */
  from?: string;
  to?: string;
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
 * Dois modos:
 * - Sem from/to → ESTOQUE (todas abertas)
 * - Com from/to → PERIODO (tocadas no periodo)
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
