import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchDesempenhoVendas, EMPTY_DESEMPENHO_DATA } from "@/services/bi/desempenhoVendasService";
import type { DesempenhoVendasFilterOptions, DesempenhoVendasData } from "@/types/desempenhoVendas";
import { biFiltersKey } from "@/lib/bi/biFilterContract";

export function useDesempenhoVendas(options: DesempenhoVendasFilterOptions = {}) {
  const query = useQuery<DesempenhoVendasData>({
    queryKey: [
      "bi-desempenho-vendas",
      biFiltersKey({
        from: options.from,
        to: options.to,
        vendedor: options.vendedor,
        cidade: options.cidade,
        condicao: options.condicao,
        produto: options.produto,
        origem: options.origem,
        banco: options.banco,
        motivoPerda: options.motivoPerda,
        funis: options.funis,
      }),
      options.ano ?? null,
    ],
    queryFn: () => fetchDesempenhoVendas(options),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  return {
    data: query.data ?? EMPTY_DESEMPENHO_DATA,
    hasData: Boolean(query.data),
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}
