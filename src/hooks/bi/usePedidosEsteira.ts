import { useQuery } from "@tanstack/react-query";
import {
  fetchPedidosEsteira,
  type FetchPedidosEsteiraOptions,
  type PedidosEsteiraData,
} from "@/services/bi/pedidosEsteiraService";

export function usePedidosEsteira(
  options: FetchPedidosEsteiraOptions & { enabled?: boolean } = {},
) {
  const { enabled = true, ...fetchOptions } = options;

  return useQuery<PedidosEsteiraData>({
    queryKey: ["pedidos-esteira", fetchOptions],
    queryFn: () => fetchPedidosEsteira(fetchOptions),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}
