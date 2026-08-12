import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchAcoesEvolucaoMensalAnoCorrente } from "@/services/bi/biRpcService";
import type { AcoesBIEvolucaoMensalAnoCorrente } from "@/types/biRpc";

const STALE_TIME = 5 * 60_000;

interface UseAcoesEvolucaoMensalAnoCorrenteOptions {
  vendedor?: string;
  tipoAcao?: string;
  cidade?: string;
  enabled?: boolean;
}

/** Serie janeiro -> mes atual, preservando somente os filtros dimensionais. */
export function useAcoesEvolucaoMensalAnoCorrenteRpc({
  vendedor,
  tipoAcao,
  cidade,
  enabled = true,
}: UseAcoesEvolucaoMensalAnoCorrenteOptions) {
  return useQuery<AcoesBIEvolucaoMensalAnoCorrente[], Error>({
    queryKey: ["rpc", "acoes-evolucao-mensal-ano-corrente", vendedor ?? null, tipoAcao ?? null, cidade ?? null],
    queryFn: () => fetchAcoesEvolucaoMensalAnoCorrente({ vendedor, tipoAcao, cidade }),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}
