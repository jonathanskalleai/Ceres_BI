import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchAcoesTermometroFechamento } from "@/services/bi/acoesTermometroService";
import type { AcoesTermometroEscopo, RpcAcoesTermometroFechamento } from "@/types/biRpc";

const STALE_TIME = 5 * 60_000;

interface UseAcoesTermometroFechamentoOptions {
  from?: string;
  to?: string;
  vendedor?: string;
  cidade?: string;
  escopo: AcoesTermometroEscopo;
  enabled?: boolean;
}

/** Termômetro da carteira aberta, separado dos agregados pesados da tela. */
export function useAcoesTermometroFechamentoRpc({
  from,
  to,
  vendedor,
  cidade,
  escopo,
  enabled = true,
}: UseAcoesTermometroFechamentoOptions) {
  return useQuery<RpcAcoesTermometroFechamento, Error>({
    queryKey: ["rpc", "acoes-termometro-fechamento", from ?? null, to ?? null, vendedor ?? null, cidade ?? null, escopo],
    queryFn: () => fetchAcoesTermometroFechamento({ from, to, vendedor, cidade, escopo }),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}
