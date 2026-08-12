import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchAcoesTaxaGanhoNegocios } from "@/services/bi/acoesGestaoService";
import type { AcoesTaxaGanhoNegocios } from "@/types/biRpc";

interface UseAcoesTaxaGanhoNegociosOptions {
  from?: string;
  to?: string;
  vendedor?: string;
  cidade?: string;
  enabled?: boolean;
}

/** Taxa operacional de ganho sobre oportunidades abertas tocadas no recorte. */
export function useAcoesTaxaGanhoNegociosRpc({
  from,
  to,
  vendedor,
  cidade,
  enabled = true,
}: UseAcoesTaxaGanhoNegociosOptions) {
  return useQuery<AcoesTaxaGanhoNegocios, Error>({
    queryKey: ["rpc", "acoes-taxa-ganho-negocios", from ?? null, to ?? null, vendedor ?? null, cidade ?? null],
    queryFn: () => fetchAcoesTaxaGanhoNegocios({ from, to, vendedor, cidade }),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    enabled: enabled && !!from && !!to,
  });
}
