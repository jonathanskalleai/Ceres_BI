import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { type DateRange } from "react-day-picker";

import {
  fetchInteligenciaEsforcoBI,
  fetchNegociosBI,
  fetchPedidosBI,
  fetchServicosBI,
} from "@/services/bi/biRpcService";
import { fetchParqueRenovacaoBI } from "@/services/bi/biRpcStaticService";
import { toISODate } from "@/lib/dateUtils";
import { resolveFunis, type CategoriaFilter } from "@/lib/categoriaFunil";

// ---------------------------------------------------------------------------
// Result type (mirrors the old useInteligenciaBI contract)
// ---------------------------------------------------------------------------

export interface InteligenciaBIResult {
  // BLOCO 1: Funil & Esforco
  winRatePorVendedor: Array<{ name: string; ganhos: number; perdidos: number; taxa: number }>;
  motivosPerda: Array<{ name: string; valor: number; count: number }>;
  visitasPorNegocioGanho: Array<{ name: string; visitas: number; negocios: number; ratio: number }>;

  // BLOCO 2: Performance Financeira
  mixFaturamento: { financiado: number; recursoProprio: number; total: number };
  sharePorBanco: Array<{ name: string; valor: number }>;
  receitaPorCidade: Array<{ cidade: string; valor: number }>;

  // BLOCO 3: Inteligencia de Mercado
  frotaRenovacao: Array<{ marca: string; clientesComFrotaAntiga: number; totalMaquinas: number; isNossaMarca: boolean }>;

  // BLOCO 4: Pos-Venda SLA
  slaPorFilial: Array<{ filial: string; mediaDias: number; totalOS: number }>;
  slaPorTipoOS: Array<{ tipo: string; mediaDias: number; totalOS: number }>;

  isLoading: boolean;
  errors: Error[];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const STALE_TIME = 5 * 60_000;

/** Permite carregar somente os agregados necessários em uma composição de BI. */
export type InteligenciaScope = "funil" | "perdas" | "financeiro" | "mercado" | "sla";

export function useInteligenciaBIRpc(
  active: boolean,
  dateRange: DateRange | undefined,
  categoria?: CategoriaFilter,
  funil?: string,
  scopes?: readonly InteligenciaScope[],
  vendedor?: string,
  cidade?: string,
): InteligenciaBIResult {
  const from = toISODate(dateRange?.from);
  const to = toISODate(dateRange?.to ?? dateRange?.from);
  const funis = resolveFunis(categoria, funil) ?? null;
  const selectedScopes = scopes ? new Set(scopes) : null;
  const includes = (scope: InteligenciaScope) => selectedScopes === null || selectedScopes.has(scope);

  const dateEnabled = active && !!from && !!to;

  // 1. Win rate + visitas/negocio ganho
  const { data: esforcoData, isLoading: loadEsforco, isError: esforcoError, error: esforcoQueryError } = useQuery({
    queryKey: ["rpc", "inteligencia-esforco", from, to, funis],
    queryFn: () => fetchInteligenciaEsforcoBI(from!, to!, funis),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: dateEnabled && includes("funil"),
  });

  // 2. Pedidos (sharePorBanco + mixFaturamento + porCidade)
  const { data: pedidosData, isLoading: loadPedidos, isError: pedidosError, error: pedidosQueryError } = useQuery({
    queryKey: ["rpc", "pedidos-bi", from, to, vendedor ?? null, cidade ?? null],
    queryFn: () => fetchPedidosBI(from!, to!, vendedor, cidade),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: dateEnabled && includes("financeiro"),
  });

  // 3. Parque renovacao (no date filter)
  const { data: parqueData, isLoading: loadParque, isError: parqueError, error: parqueQueryError } = useQuery({
    queryKey: ["rpc", "parque-renovacao"],
    queryFn: () => fetchParqueRenovacaoBI(),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: active && includes("mercado"),
  });

  // 4. Servicos (slaPorFilial + slaPorTipoOS)
  const { data: servicosData, isLoading: loadServicos, isError: servicosError, error: servicosQueryError } = useQuery({
    queryKey: ["rpc", "servicos-bi", from, to, cidade ?? null],
    queryFn: () => fetchServicosBI(from!, to!, cidade),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: dateEnabled && includes("sla"),
  });

  // 5. Negocios (motivosPerda) — same queryKey used by ComercialSection = dedup
  const { data: negociosData, isLoading: loadNegocios, isError: negociosError, error: negociosQueryError } = useQuery({
    queryKey: ["rpc", "negocios-bi", from, to, funis ?? null, vendedor ?? null, cidade ?? null],
    queryFn: () => fetchNegociosBI(from!, to!, funis ?? undefined, vendedor, cidade),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: dateEnabled && includes("perdas"),
  });

  const isLoading = loadEsforco || loadPedidos || loadParque || loadServicos || loadNegocios;
  const errors = [
    esforcoError ? esforcoQueryError : null,
    pedidosError ? pedidosQueryError : null,
    parqueError ? parqueQueryError : null,
    servicosError ? servicosQueryError : null,
    negociosError ? negociosQueryError : null,
  ].filter((error): error is Error => error instanceof Error);

  return {
    // BLOCO 1
    winRatePorVendedor: esforcoData?.winRatePorVendedor ?? [],
    motivosPerda: (negociosData?.motivosPerda ?? []).map((item) => ({
      name: item.name,
      valor: item.valor,
      count: item.qtd,
    })),
    visitasPorNegocioGanho: esforcoData?.visitasPorNegocioGanho ?? [],

    // BLOCO 2
    mixFaturamento: pedidosData?.mixFaturamento ?? { financiado: 0, recursoProprio: 0, total: 0 },
    sharePorBanco: pedidosData?.sharePorBanco ?? [],
    receitaPorCidade: (pedidosData?.porCidade ?? []).map((c) => ({ cidade: c.name, valor: c.value })),

    // BLOCO 3
    frotaRenovacao: parqueData?.frotaRenovacao ?? [],

    // BLOCO 4
    slaPorFilial: servicosData?.slaPorFilial ?? [],
    slaPorTipoOS: servicosData?.slaPorTipoOS ?? [],

    isLoading,
    errors,
  };
}
