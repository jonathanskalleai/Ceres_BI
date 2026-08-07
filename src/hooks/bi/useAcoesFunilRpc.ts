import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchAcoesFunilGestao } from "@/services/bi/acoesGestaoService";
import type { RpcAcoesFunilGestao } from "@/types/biRpc";

const STALE_TIME = 5 * 60_000; // 5 minutes

interface UseAcoesFunilOptions {
  from?: string;
  to?: string;
  vendedor?: string;
  cidade?: string;
  enabled?: boolean;
}

/**
 * Hook for rpc_acoes_funil_gestao — agregados de gestao comercial.
 *
 * Payload pequeno (~20 consultores, < 2KB) e de cardinalidade LIMITADA: por
 * isso vive numa RPC propria, separada das listas de clientes (carteira tem
 * 8.731 registros) e do payload de `rpc_acoes_bi`, que ja viaja 4x no app.
 */
export function useAcoesFunilRpc({
  from,
  to,
  vendedor,
  cidade,
  enabled = true,
}: UseAcoesFunilOptions) {
  return useQuery<RpcAcoesFunilGestao, Error>({
    queryKey: ["rpc", "acoes-funil-gestao", from ?? null, to ?? null, vendedor ?? null, cidade ?? null],
    queryFn: () => fetchAcoesFunilGestao({ from, to, vendedor, cidade }),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}
