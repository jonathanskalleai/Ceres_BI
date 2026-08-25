import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  fetchEquipeDesempenho,
  type EquipeDesempenhoParams,
} from "@/services/equipeDesempenhoService";
import type { EquipeDesempenhoData } from "@/types/equipeDesempenho";

export function useEquipeDesempenho(params: EquipeDesempenhoParams) {
  return useQuery<EquipeDesempenhoData, Error>({
    queryKey: [
      "rpc",
      "equipe-desempenho-mensal",
      params.ano,
      params.consultor ?? null,
      params.cidade ?? null,
    ],
    queryFn: () => fetchEquipeDesempenho(params),
    // A origem é sincronizada pelo ETL; manter o dado evita nova carga em
    // toda navegação de volta para Equipe.
    staleTime: 15 * 60_000,
    gcTime: 60 * 60_000,
    placeholderData: keepPreviousData,
  });
}
