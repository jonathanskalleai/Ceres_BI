import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchAcoesEmAndamento } from "@/services/bi/acoesEmAndamentoService";
import type { RpcEmAndamento } from "@/services/bi/acoesEmAndamentoService";

const STALE_TIME = 5 * 60_000; // 5 minutes

export const EM_ANDAMENTO_PAGE_SIZE = 50;

interface UseEmAndamentoRpcOptions {
  from?: string;
  to?: string;
  vendedor?: string;
  cidade?: string;
  /** Pagina atual (1-based). Default 1. */
  page?: number;
  /** Limite de linhas; o modal de alertas busca a carteira completa uma vez. */
  limit?: number;
  enabled?: boolean;
}

/**
 * Hook for rpc_acoes_em_andamento — negócios em andamento no período (Story 5-A).
 *
 * Paginacao server-side: cada pagina faz um round-trip com LIMIT/OFFSET.
 * `keepPreviousData` evita flash ao trocar de pagina.
 */
export function useEmAndamentoRpc({
  from,
  to,
  vendedor,
  cidade,
  page = 1,
  limit = EM_ANDAMENTO_PAGE_SIZE,
  enabled = true,
}: UseEmAndamentoRpcOptions) {
  const offset = (page - 1) * limit;

  return useQuery<RpcEmAndamento, Error>({
    queryKey: [
      "rpc", "acoes-em-andamento",
      from ?? null, to ?? null, vendedor ?? null, cidade ?? null,
      page, limit,
    ],
    queryFn: () => fetchAcoesEmAndamento({ from, to, vendedor, cidade, limit, offset }),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}
