import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchAcoesDetalhe } from "@/services/bi/biRpcService";
import type { RpcAcoesDetalhe } from "@/types/biRpc";

const STALE_TIME = 5 * 60_000; // 5 minutes

/** Linhas por pagina da tabela "Acoes do Periodo". */
export const ACOES_PAGE_SIZE = 50;

interface UseAcoesDetalheOptions {
  from?: string;
  to?: string;
  vendedor?: string;
  tipoAcao?: string;
  cidade?: string;
  statusNegocio?: string;
  /** Pagina atual (1-based). Default 1. */
  page?: number;
  enabled?: boolean;
}

/**
 * Hook for rpc_acoes_detalhe — linhas da tabela "Acoes do Periodo".
 *
 * Paginacao server-side: cada pagina faz um round-trip com LIMIT/OFFSET.
 * `keepPreviousData` evita flash ao trocar de pagina.
 */
export function useAcoesDetalheRpc({
  from,
  to,
  vendedor,
  tipoAcao,
  cidade,
  statusNegocio,
  page = 1,
  enabled = true,
}: UseAcoesDetalheOptions) {
  const limit = ACOES_PAGE_SIZE;
  const offset = (page - 1) * ACOES_PAGE_SIZE;

  return useQuery<RpcAcoesDetalhe, Error>({
    queryKey: ["rpc", "acoes-detalhe", from ?? null, to ?? null, vendedor ?? null, tipoAcao ?? null, cidade ?? null, statusNegocio ?? null, page],
    queryFn: () => fetchAcoesDetalhe({ from, to, vendedor, tipoAcao, cidade, statusNegocio, limit, offset }),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}
