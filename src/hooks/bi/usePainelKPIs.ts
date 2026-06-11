import { useMemo } from "react";
import { type DateRange } from "react-day-picker";
import { type CategoriaFilter } from "@/lib/categoriaFunil";
import { useNegociosBI, type NegociosAgg } from "@/hooks/bi/useNegociosBI";
import { useAcoesBI, type AcoesBIResult } from "@/hooks/bi/useAcoesBI";
import { useOperacionalData, type OperacionalAgg } from "@/hooks/bi/useOperacionalData";

type Trend = "up" | "down" | "neutral";

interface KPIWithDelta {
  value: number;
  delta: number;
  trend: Trend;
}

export interface PainelKPIs {
  // Negocios
  totalNegocios: KPIWithDelta;
  ganhos: KPIWithDelta;
  perdidos: KPIWithDelta;
  andamento: KPIWithDelta;
  taxaConversao: KPIWithDelta;
  // Valores
  valorGanho: KPIWithDelta;
  valorPerdido: KPIWithDelta;
  pipelineAberto: KPIWithDelta;
  ticketMedio: KPIWithDelta;
  // Acoes / Operacional
  totalAcoes: KPIWithDelta;
  totalVisitas: KPIWithDelta;
  totalOS: KPIWithDelta;
  porTipoAcao: Array<{ name: string; value: number; delta: number; trend: Trend }>;
}

export interface UsePainelResult {
  kpis: PainelKPIs;
  isLoading: boolean;
}

function calcDelta(atual: number, anterior: number): { delta: number; trend: Trend } {
  if (anterior === 0 && atual === 0) return { delta: 0, trend: "neutral" };
  if (anterior === 0) return { delta: 100, trend: "up" };
  const delta = ((atual - anterior) / anterior) * 100;
  const trend: Trend = delta > 0.5 ? "up" : delta < -0.5 ? "down" : "neutral";
  return { delta, trend };
}

function makeKPI(atual: number, anterior: number): KPIWithDelta {
  const { delta, trend } = calcDelta(atual, anterior);
  return { value: atual, delta, trend };
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

/**
 * Derives year string for AcoesBI filters from the dateRange.
 */
function getAnoFromDateRange(dateRange: DateRange | undefined): string {
  if (dateRange?.from) return String(dateRange.from.getFullYear());
  return String(new Date().getFullYear());
}

export function usePainelKPIs(
  dateRange: DateRange | undefined,
  categoria: CategoriaFilter,
  funil: string,
): UsePainelResult {
  const prevDateRange = useMemo(() => getPreviousDateRange(dateRange), [dateRange]);

  // Current period negocios
  const { agg: negAtual, isLoading: negLoad1 } = useNegociosBI(true, dateRange, categoria, funil);
  // Previous period negocios
  const { agg: negAnterior, isLoading: negLoad2 } = useNegociosBI(true, prevDateRange, categoria, funil);

  // Current period acoes
  const anoAtual = useMemo(() => getAnoFromDateRange(dateRange), [dateRange]);
  const anoAnterior = useMemo(() => String(Number(anoAtual) - 1), [anoAtual]);

  const filtersAtual = useMemo(() => ({
    ano: anoAtual, mes: "", vendedor: "", tipoAcao: "", cidade: "",
  }), [anoAtual]);
  const filtersAnterior = useMemo(() => ({
    ano: anoAnterior, mes: "", vendedor: "", tipoAcao: "", cidade: "",
  }), [anoAnterior]);

  const acoesAtual = useAcoesBI(true, filtersAtual, categoria, funil);
  const acoesAnterior = useAcoesBI(true, filtersAnterior, categoria, funil);

  // Operacional (single period — no historical comparison available)
  const { agg: opData, isLoading: opLoad } = useOperacionalData(true);

  const kpis = useMemo((): PainelKPIs => {
    const na = negAtual.kpis;
    const np = negAnterior.kpis;
    const aa = acoesAtual.kpis;
    const ap = acoesAnterior.kpis;

    // Build porTipoAcao with deltas
    const tipoAtualMap = new Map(acoesAtual.porTipoAcao.map((t) => [t.name, t.value]));
    const tipoAnteriorMap = new Map(acoesAnterior.porTipoAcao.map((t) => [t.name, t.value]));
    const porTipoAcao = acoesAtual.porTipoAcao.map((t) => {
      const prev = tipoAnteriorMap.get(t.name) ?? 0;
      const { delta, trend } = calcDelta(t.value, prev);
      return { name: t.name, value: t.value, delta, trend };
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
