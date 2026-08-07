import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchAcoesGestaoListas } from "@/services/bi/acoesGestaoService";
import type { AcoesGestaoListaRow, AcoesGestaoListaTipo, AcoesGestaoListas } from "@/types/biRpc";

const STALE_TIME = 5 * 60_000; // 5 minutes

/** Linhas por pagina do card "Gestao da Carteira" (o "ver todos" pede o teto). */
export const GESTAO_LISTA_PAGE = 10;
export const GESTAO_LISTA_MAX = 500;

interface UseAcoesGestaoListasOptions {
  tipo: AcoesGestaoListaTipo;
  from?: string;
  to?: string;
  vendedor?: string;
  cidade?: string;
  limit?: number;
  offset?: number;
  search?: string;
  diasMin?: number;
  diasMax?: number;
  enabled?: boolean;
}

/**
 * Hook for rpc_acoes_gestao_listas — listas de clientes PAGINADAS server-side.
 *
 * `TRow` deve casar com `tipo`:
 *   sem_contato -> AcoesSemContatoRow
 *   desperdicio -> AcoesDesperdicioRow
 *   negativas   -> AcoesNegativaRow
 *
 * A paginacao e server-side de proposito: sem LIMIT, a lista `sem_contato`
 * traria a carteira inteira (8.731 clientes) para renderizar 10 linhas.
 */
export function useAcoesGestaoListasRpc<TRow extends AcoesGestaoListaRow>({
  tipo,
  from,
  to,
  vendedor,
  cidade,
  limit = GESTAO_LISTA_PAGE,
  offset = 0,
  search,
  diasMin,
  diasMax,
  enabled = true,
}: UseAcoesGestaoListasOptions) {
  return useQuery<AcoesGestaoListas<TRow>, Error>({
    queryKey: [
      "rpc", "acoes-gestao-listas", tipo,
      from ?? null, to ?? null, vendedor ?? null, cidade ?? null,
      limit, offset, search ?? null, diasMin ?? null, diasMax ?? null,
    ],
    queryFn: () =>
      fetchAcoesGestaoListas<TRow>({ tipo, from, to, vendedor, cidade, limit, offset, search, diasMin, diasMax }),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}
