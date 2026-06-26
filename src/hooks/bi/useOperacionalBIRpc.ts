import { useQuery } from "@tanstack/react-query";
import { fetchOperacionalBI } from "@/services/bi/biRpcService";
import type { RpcOperacionalBI } from "@/types/biRpc";

const DEFAULTS: RpcOperacionalBI = {
  kpis: {
    tecnicosAtivos: 0,
    kmTotal: 0,
    utilizacaoMedia: 0,
    percentOcioso: 0,
    eventosAgenda: 0,
    taxaConclusaoAgenda: 0,
  },
  kmPorTecnico: [],
  utilizacaoPorTecnico: [],
  agendaPorStatus: [],
  agendaPorTipo: [],
};

export function useOperacionalBIRpc(enabled = true) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["bi-operacional-rpc"],
    queryFn: fetchOperacionalBI,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
    enabled,
  });

  return {
    data: data ?? DEFAULTS,
    isLoading,
    error,
  };
}
