import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchAcoesDetalhe } from "@/services/bi/biRpcService";
import type { RpcAcoesDetalhe } from "@/types/biRpc";

const STALE_TIME = 5 * 60_000; // 5 minutes

/** Teto de linhas trazidas por vez. Ano inteiro tem ~5.5k acoes; a UI avisa quando trunca. */
export const ACOES_DETALHE_LIMIT = 2000;

interface UseAcoesDetalheOptions {
  from?: string;
  to?: string;
  vendedor?: string;
  tipoAcao?: string;
  cidade?: string;
  statusNegocio?: string;
  limit?: number;
  enabled?: boolean;
}

/**
 * Hook for rpc_acoes_detalhe — linhas da tabela "Acoes do Periodo".
 *
 * Separado de `useAcoesBIRpc` de proposito: aquele payload roda 4x no app
 * (2x aqui na secao + 2x em usePainelKPIsRpc, que usa SOMENTE os kpis), entao a
 * tabela pesada — com observacao de ~200 chars por linha — fica FORA dele.
 */
export function useAcoesDetalheRpc({
  from,
  to,
  vendedor,
  tipoAcao,
  cidade,
  statusNegocio,
  limit = ACOES_DETALHE_LIMIT,
  enabled = true,
}: UseAcoesDetalheOptions) {
  return useQuery<RpcAcoesDetalhe, Error>({
    queryKey: ["rpc", "acoes-detalhe", from ?? null, to ?? null, vendedor ?? null, tipoAcao ?? null, cidade ?? null, statusNegocio ?? null, limit],
    queryFn: () => fetchAcoesDetalhe({ from, to, vendedor, tipoAcao, cidade, statusNegocio, limit }),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}
