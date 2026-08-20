import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchResultadosNegociosBI } from "@/services/bi/biRpcService";
import type { RpcResultadosNegociosBI } from "@/types/biRpc";

const STALE_TIME = 5 * 60_000;

interface UseResultadosNegociosBIOptions {
  from: string;
  to: string;
  vendedor?: string;
  cidade?: string;
  enabled?: boolean;
}

/** KPIs e análises da visão canônica de Negócios & Funil. */
export function useResultadosNegociosBIRpc({
  from,
  to,
  vendedor,
  cidade,
  enabled = true,
}: UseResultadosNegociosBIOptions) {
  return useQuery<RpcResultadosNegociosBI, Error>({
    queryKey: ["rpc", "resultados-negocios-bi", from, to, vendedor ?? null, cidade ?? null],
    queryFn: () => fetchResultadosNegociosBI(from, to, vendedor, cidade),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: enabled && !!from && !!to,
  });
}
