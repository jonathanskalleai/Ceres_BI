import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { type DateRange } from "react-day-picker";
import { type CategoriaFilter, resolveFunis } from "@/lib/categoriaFunil";
import { toISODate, type Trend } from "@/lib/dateUtils";
import { fetchPainelKPIs } from "@/services/bi/painelService";

export interface PainelKPI {
  value: number | null;
  previousValue: number | null;
  trend: Trend;
  valueStatus?: "ready" | "missing";
  previousValueStatus?: "ready" | "missing" | "not_available";
}

export interface PainelKPIs {
  totalNegocios: PainelKPI;
  ganhos: PainelKPI;
  perdidos: PainelKPI;
  andamento: PainelKPI;
  taxaConversao: PainelKPI;
  valorGanho: PainelKPI;
  valorPerdido: PainelKPI;
  pipelineAberto: PainelKPI;
  ticketMedio: PainelKPI;
  totalAcoes: PainelKPI;
  totalVisitas: PainelKPI;
  totalOS: PainelKPI;
  porTipoAcao: Array<{ name: string; value: number | null; previousValue: number | null; trend: Trend }>;
  oportunidadesAbertas: PainelKPI;
  visitasPorOportunidade: PainelKPI;
  diasParados: PainelKPI;
  negociosOutrosStatus: number | null;
  ignoresFunilFilter: Record<string, boolean>;
  dataQuality?: {
    status: "ready" | "partial";
    missing: string[];
  };
}

export interface UsePainelResult {
  kpis: PainelKPIs;
  isLoading: boolean;
  loading: {
    negocios: boolean;
    acoes: boolean;
    funil: boolean;
    operacional: boolean;
  };
  comparisonReady: boolean;
}

const EMPTY_KPI: PainelKPI = {
  value: null,
  previousValue: null,
  trend: "neutral",
  valueStatus: "missing",
  previousValueStatus: "missing",
};

const EMPTY_KPIS: PainelKPIs = {
  totalNegocios: EMPTY_KPI,
  ganhos: EMPTY_KPI,
  perdidos: EMPTY_KPI,
  andamento: EMPTY_KPI,
  taxaConversao: EMPTY_KPI,
  valorGanho: EMPTY_KPI,
  valorPerdido: EMPTY_KPI,
  pipelineAberto: EMPTY_KPI,
  ticketMedio: EMPTY_KPI,
  totalAcoes: EMPTY_KPI,
  totalVisitas: EMPTY_KPI,
  totalOS: EMPTY_KPI,
  porTipoAcao: [],
  oportunidadesAbertas: EMPTY_KPI,
  visitasPorOportunidade: EMPTY_KPI,
  diasParados: EMPTY_KPI,
  negociosOutrosStatus: 0,
  ignoresFunilFilter: {},
  dataQuality: { status: "partial", missing: ["panel.kpis"] },
};

/**
 * The panel is now a single server-composed read model. PostgreSQL-backed RPCs
 * still provide the facts, while Python computes current/previous KPI values,
 * trends and ticket médio before React receives the response.
 */
export function usePainelKPIsRpc(
  dateRange: DateRange | undefined,
  categoria: CategoriaFilter,
  funil: string,
  vendedor?: string,
  cidade?: string,
): UsePainelResult {
  const from = toISODate(dateRange?.from) ?? "";
  const to = toISODate(dateRange?.to ?? dateRange?.from) ?? "";
  const funis = resolveFunis(categoria, funil);
  const enabled = Boolean(from && to);
  const query = useQuery<PainelKPIs, Error>({
    queryKey: ["bi", "painel-kpis", from, to, funis ?? null, vendedor ?? null, cidade ?? null],
    queryFn: () => fetchPainelKPIs({ from, to, funis, vendedor, cidade }),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    enabled,
  });

  const isLoading = query.isLoading;
  return {
    kpis: query.data ?? EMPTY_KPIS,
    isLoading,
    loading: {
      negocios: isLoading,
      acoes: isLoading,
      funil: isLoading,
      operacional: isLoading,
    },
    comparisonReady: Boolean(query.data),
  };
}
