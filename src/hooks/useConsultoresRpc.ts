import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  fetchConsultoresResumoAcoes,
  type ConsultoresResumoParams,
} from "@/services/consultoresRpcService";
import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";

const STALE_TIME = 10 * 60_000; // 10 min — dados mudam apenas com ETL (~15min)
const GC_TIME = 60 * 60_000;   // 1h — mantém em memória para back/forward

export function useConsultoresResumoAcoes(
  params: ConsultoresResumoParams & { enabled?: boolean },
) {
  const { enabled = true, ...rpcParams } = params;

  return useQuery<RpcConsultorResumoAcoes[], Error>({
    queryKey: [
      "rpc",
      "consultores-resumo-acoes",
      rpcParams.from,
      rpcParams.to,
      rpcParams.vendedor ?? null,
      rpcParams.cidade ?? null,
      rpcParams.tipoAcao ?? null,
    ],
    queryFn: () => fetchConsultoresResumoAcoes(rpcParams),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: keepPreviousData,
    enabled: enabled && !!rpcParams.from && !!rpcParams.to,
  });
}
