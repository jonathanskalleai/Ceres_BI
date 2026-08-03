import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchAcoesPedidosGanhos } from "@/services/bi/acoesPedidosGanhosService";
import type { RpcPedidosGanhos } from "@/services/bi/acoesPedidosGanhosService";

const STALE_TIME = 5 * 60_000; // 5 minutes

export const PEDIDOS_GANHOS_PAGE_SIZE = 50;

interface UsePedidosGanhosRpcOptions {
  from?: string;
  to?: string;
  vendedor?: string;
  cidade?: string;
  /** Pagina atual (1-based). Default 1. */
  page?: number;
  enabled?: boolean;
}

/**
 * Hook for rpc_acoes_pedidos_ganhos — pedidos aprovados no período (Story 4-A).
 *
 * Paginacao server-side: cada pagina faz um round-trip com LIMIT/OFFSET.
 * `keepPreviousData` evita flash ao trocar de pagina.
 */
export function usePedidosGanhosRpc({
  from,
  to,
  vendedor,
  cidade,
  page = 1,
  enabled = true,
}: UsePedidosGanhosRpcOptions) {
  const limit = PEDIDOS_GANHOS_PAGE_SIZE;
  const offset = (page - 1) * PEDIDOS_GANHOS_PAGE_SIZE;

  return useQuery<RpcPedidosGanhos, Error>({
    queryKey: [
      "rpc", "acoes-pedidos-ganhos",
      from ?? null, to ?? null, vendedor ?? null, cidade ?? null,
      page,
    ],
    queryFn: () => fetchAcoesPedidosGanhos({ from, to, vendedor, cidade, limit, offset }),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}
