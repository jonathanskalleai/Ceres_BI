import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchClientesCriticos } from "@/services/bi/biRpcService";
import type { RpcClientesCriticosBI } from "@/types/biRpc";

interface UseClientesCriticosOptions {
  vendedor?: string;
  cidade?: string;
  enabled?: boolean;
}

export function useClientesCriticosRpc({ vendedor, cidade, enabled = true }: UseClientesCriticosOptions) {
  return useQuery<RpcClientesCriticosBI, Error>({
    queryKey: ["rpc", "clientes-criticos", vendedor ?? null, cidade ?? null],
    queryFn: () => fetchClientesCriticos({ vendedor, cidade, diasMin: 365, limit: 5 }),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    enabled,
  });
}
