import { useMemo } from "react";
import { type DateRange } from "react-day-picker";
import { type CategoriaFilter } from "@/lib/categoriaFunil";
import { useNegociosBI, type NegociosAgg } from "@/hooks/bi/useNegociosBI";
import { useAcoesBI, type AcoesBIResult } from "@/hooks/bi/useAcoesBI";
import { useOperacionalData, type OperacionalAgg } from "@/hooks/bi/useOperacionalData";

type Trend = "up" | "down" | "neutral";

interface KPIWithPrev {
  value: number;
  previousValue: number;
  trend: Trend;
}

export interface PainelKPIs {
  // Negocios
  totalNegocios: KPIWithPrev;
  ganhos: KPIWithPrev;
  perdidos: KPIWithPrev;
  andamento: KPIWithPrev;
  taxaConversao: KPIWithPrev;
  // Valores
  valorGanho: KPIWithPrev;
  valorPerdido: KPIWithPrev;
  pipelineAberto: KPIWithPrev;
  ticketMedio: KPIWithPrev;
  // Acoes / Operacional
  totalAcoes: KPIWithPrev;
  totalVisitas: KPIWithPrev;
  totalOS: KPIWithPrev;
  porTipoAcao: Array<{ name: string; value: number; previousValue: number; trend: Trend }>;
}

export interface UsePainelResult {
  kpis: PainelKPIs;
  isLoading: boolean;
}

function calcTrend(atual: number, anterior: number): Trend {
  if (atual > anterior) return "up";
  if (atual < anterior) return "down";
  return "neutral";
}

function makeKPI(atual: number, anterior: number): KPIWithPrev {
  return { value: atual, previousValue: anterior, trend: calcTrend(atual, anterior) };
}

/**
 * Derives a DateRange for the previous year based on the current dateRange.
 * If no dateRange is set, compares current year with previous year.
 */
function getPreviousDateRange(dateRange: DateRange | undefined): DateRange | undefined {
  if (!dateRange?.from) {
    // No date filter active — compare current year with previous
    const now = new Date();
    const curYear = now.getFullYear();
    return {
      from: new Date(curYear - 1, 0, 1),
      to: new Date(curYear - 1, 11, 31),
    };
  }
  // Shift the entire range back 1 year
  const from = new Date(dateRange.from);
  from.setFullYear(from.getFullYear() - 1);
  const to = dateRange.to ? new Date(dateRange.to) : new Date(dateRange.from);
  to.setFullYear(to.getFullYear() - 1);
  return { from, to };
}

export function usePainelKPIs(
  dateRange: DateRange | undefined,
  categoria: CategoriaFilter,
  funil: string,
  vendedor?: string,
  cidade?: string,
): UsePainelResult {
  const prevDateRange = useMemo(() => getPreviousDateRange(dateRange), [dateRange]);

  // Current period negocios
  const { agg: negAtual, isLoading: negLoad1 } = useNegociosBI(true, dateRange, categoria, funil);
  // Previous period negocios
  const { agg: negAnterior, isLoading: negLoad2 } = useNegociosBI(true, prevDateRange, categoria, funil);

  // Current period acoes — use real dateRange instead of just year string
  const filtersAtual = useMemo(() => ({
    ano: "", mes: "", vendedor: vendedor ?? "", tipoAcao: "", cidade: cidade ?? "",
    dateRange,
  }), [dateRange, vendedor, cidade]);
  const filtersAnterior = useMemo(() => ({
    ano: "", mes: "", vendedor: vendedor ?? "", tipoAcao: "", cidade: cidade ?? "",
    dateRange: prevDateRange,
  }), [prevDateRange, vendedor, cidade]);

  const acoesAtual = useAcoesBI(true, filtersAtual, categoria, funil);
  const acoesAnterior = useAcoesBI(true, filtersAnterior, categoria, funil);

  // Operacional (single period — no historical comparison available)
  const { agg: opData, isLoading: opLoad } = useOperacionalData(true);

  const kpis = useMemo((): PainelKPIs => {
    const na = negAtual.kpis;
    const np = negAnterior.kpis;
    const aa = acoesAtual.kpis;
    const ap = acoesAnterior.kpis;

    // Build porTipoAcao with previous values
    const tipoAnteriorMap = new Map(acoesAnterior.porTipoAcao.map((t) => [t.name, t.value]));
    const porTipoAcao = acoesAtual.porTipoAcao.map((t) => {
      const prev = tipoAnteriorMap.get(t.name) ?? 0;
      return { name: t.name, value: t.value, previousValue: prev, trend: calcTrend(t.value, prev) };
    });

    return {
      totalNegocios: makeKPI(na.totalNegocios, np.totalNegocios),
      ganhos: makeKPI(na.ganhos, np.ganhos),
      perdidos: makeKPI(na.perdidos, np.perdidos),
      andamento: makeKPI(na.andamento, np.andamento),
      taxaConversao: makeKPI(na.taxaConversao, np.taxaConversao),
      valorGanho: makeKPI(na.valorGanho, np.valorGanho),
      valorPerdido: makeKPI(na.pipelinePerdido, np.pipelinePerdido),
      pipelineAberto: makeKPI(na.pipelineAberto, np.pipelineAberto),
      ticketMedio: makeKPI(na.ticketMedioGanho, np.ticketMedioGanho),
      totalAcoes: makeKPI(aa.totalAcoes, ap.totalAcoes),
      totalVisitas: makeKPI(aa.visitas, ap.visitas),
      totalOS: makeKPI(opData.kpis.eventosAgenda, 0), // no previous for operacional
      porTipoAcao,
    };
  }, [negAtual, negAnterior, acoesAtual, acoesAnterior, opData]);

  const isLoading = negLoad1 || negLoad2 || acoesAtual.isLoading || acoesAnterior.isLoading || opLoad;

  return { kpis, isLoading };
}
