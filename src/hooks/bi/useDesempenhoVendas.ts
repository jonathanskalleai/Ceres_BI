import { useQuery } from "@tanstack/react-query";
import { fetchDesempenhoVendas, EMPTY_DESEMPENHO_DATA } from "@/services/bi/desempenhoVendasService";
import type { DesempenhoVendasFilterOptions, DesempenhoVendasData } from "@/types/desempenhoVendas";

export function useDesempenhoVendas(options: DesempenhoVendasFilterOptions = {}) {
  const query = useQuery<DesempenhoVendasData>({
    queryKey: [
      "bi-desempenho-vendas",
      options.ano,
      options.from,
      options.to,
      options.vendedor,
      options.cidade,
      options.condicao,
    ],
    queryFn: () => fetchDesempenhoVendas(options),
    staleTime: 5 * 60_000,
  });

  return {
    data: query.data ?? EMPTY_DESEMPENHO_DATA,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
