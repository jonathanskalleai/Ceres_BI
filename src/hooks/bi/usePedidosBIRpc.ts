import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchPedidosBI } from "@/services/bi/biRpcService";
import type { RpcPedidosBI } from "@/types/biRpc";

const STALE_TIME = 5 * 60_000; // 5 minutes

interface UsePedidosBIOptions {
  from: string;
  to: string;
  vendedor?: string;
  cidade?: string;
  enabled?: boolean;
}

/**
 * Hook for rpc_pedidos_bi — server-side aggregation of order metrics.
 * Returns KPIs, monthly evolution, status breakdown, payment mix,
 * and rankings by seller and city.
 */
export function usePedidosBIRpc({
  from,
  to,
  vendedor,
  cidade,
  enabled = true,
}: UsePedidosBIOptions) {
  return useQuery<RpcPedidosBI, Error>({
    queryKey: ["rpc", "pedidos-bi", from, to, vendedor ?? null, cidade ?? null],
    queryFn: () => fetchPedidosBI(from, to, vendedor, cidade),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: enabled && !!from && !!to,
  });
}
