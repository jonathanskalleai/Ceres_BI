import { useQuery } from "@tanstack/react-query";
import { fetchProdutosBI } from "@/services/bi/biRpcService";
import type { RpcProdutosBI } from "@/types/biRpc";

const DEFAULTS: RpcProdutosBI = {
  kpis: {
    totalMaquinas: 0,
    clientesComParque: 0,
    gruposDistintos: 0,
    marcasDistintas: 0,
  },
  porGrupo: [],
  porMarca: [],
  topModelos: [],
};

export function useProdutosBIRpc(enabled = true) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["bi-produtos-rpc"],
    queryFn: fetchProdutosBI,
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
