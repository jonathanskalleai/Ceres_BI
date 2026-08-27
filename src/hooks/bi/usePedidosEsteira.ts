import { useQuery } from "@tanstack/react-query";
import {
  fetchPedidosEsteira,
  type FetchPedidosEsteiraOptions,
  type PedidosEsteiraData,
} from "@/services/bi/pedidosEsteiraService";

export function usePedidosEsteira(options: FetchPedidosEsteiraOptions = {}) {
  return useQuery<PedidosEsteiraData>({
    queryKey: ["pedidos-esteira", options],
    queryFn: () => fetchPedidosEsteira(options),
    staleTime: 5 * 60 * 1000,
  });
}
