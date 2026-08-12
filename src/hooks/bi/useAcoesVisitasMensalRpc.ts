import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchAcoesVisitasMensal } from "@/services/bi/biRpcService";
import type { AcoesBIVisitasMensal } from "@/types/biRpc";

const STALE_TIME = 5 * 60_000;

interface UseAcoesVisitasMensalOptions {
  from?: string;
  to?: string;
  vendedor?: string;
  tipoAcao?: string;
  cidade?: string;
  enabled?: boolean;
}

/** Serie mensal de visitas da aba Acoes, com os mesmos filtros do agregado. */
export function useAcoesVisitasMensalRpc({
  from,
  to,
  vendedor,
  tipoAcao,
  cidade,
  enabled = true,
}: UseAcoesVisitasMensalOptions) {
  return useQuery<AcoesBIVisitasMensal[], Error>({
    queryKey: ["rpc", "acoes-visitas-mensal", from ?? null, to ?? null, vendedor ?? null, tipoAcao ?? null, cidade ?? null],
    queryFn: () => fetchAcoesVisitasMensal({ from, to, vendedor, tipoAcao, cidade }),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}
