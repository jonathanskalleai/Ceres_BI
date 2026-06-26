import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchPedidosBI } from "@/services/bi/biRpcService";
import type { RpcPedidosBI } from "@/types/biRpc";

const STALE_TIME = 5 * 60_000; // 5 minutes

interface UsePedidosBIOptions {
  from: string;
  to: string;
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
  enabled = true,
}: UsePedidosBIOptions) {
  return useQuery<RpcPedidosBI, Error>({
    queryKey: ["rpc", "pedidos-bi", from, to],
    queryFn: () => fetchPedidosBI(from, to),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: enabled && !!from && !!to,
  });
}
