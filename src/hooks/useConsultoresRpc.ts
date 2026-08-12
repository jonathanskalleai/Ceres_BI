import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  fetchConsultoresResumoAcoes,
  type ConsultoresResumoParams,
} from "@/services/consultoresRpcService";
import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";

const STALE_TIME = 5 * 60_000;

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
    placeholderData: keepPreviousData,
    enabled: enabled && !!rpcParams.from && !!rpcParams.to,
  });
}
