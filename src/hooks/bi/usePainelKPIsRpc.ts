import { useMemo } from "react";
import { type DateRange } from "react-day-picker";
import { type CategoriaFilter, resolveFunis } from "@/lib/categoriaFunil";
import { toISODate } from "@/lib/dateUtils";
import { useNegociosBIRpc } from "@/hooks/bi/useNegociosBIRpc";
import { useAcoesBIRpc } from "@/hooks/bi/useAcoesBIRpc";
import { useOperacionalData } from "@/hooks/bi/useOperacionalData";

// ---------------------------------------------------------------------------
// Types (migrated from usePainelKPIs.ts — canonical source now)
// ---------------------------------------------------------------------------

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
 */
function getPreviousDateRange(dateRange: DateRange | undefined): DateRange | undefined {
  if (!dateRange?.from) {
    const now = new Date();
    const curYear = now.getFullYear();
    return {
      from: new Date(curYear - 1, 0, 1),
      to: new Date(curYear - 1, 11, 31),
    };
  }
  const from = new Date(dateRange.from);
  from.setFullYear(from.getFullYear() - 1);
  const to = dateRange.to ? new Date(dateRange.to) : new Date(dateRange.from);
  to.setFullYear(to.getFullYear() - 1);
  return { from, to };
}

/**
 * RPC-based replacement for usePainelKPIs.
 * Uses server-side aggregation via rpc_negocios_bi and rpc_acoes_bi.
 * Keeps useOperacionalData as-is (SQL Server, not migratable).
 */
export function usePainelKPIsRpc(
  dateRange: DateRange | undefined,
  categoria: CategoriaFilter,
  funil: string,
  vendedor?: string,
  cidade?: string,
): UsePainelResult {
  const prevDateRange = useMemo(() => getPreviousDateRange(dateRange), [dateRange]);

  // Current + previous date ISO strings
  const fromAtual = useMemo(() => toISODate(dateRange?.from), [dateRange?.from]);
  const toAtual = useMemo(() => toISODate(dateRange?.to ?? dateRange?.from), [dateRange?.to, dateRange?.from]);
  const fromAnterior = useMemo(() => toISODate(prevDateRange?.from), [prevDateRange?.from]);
  const toAnterior = useMemo(() => toISODate(prevDateRange?.to ?? prevDateRange?.from), [prevDateRange?.to, prevDateRange?.from]);

  // Funis filter from categoria + funil (mirrors ComercialSection logic)
  const funis = useMemo(() => resolveFunis(categoria, funil), [categoria, funil]);

  // Negocios — current period
  const { data: negAtual, isLoading: negLoad1 } = useNegociosBIRpc({
    from: fromAtual,
    to: toAtual,
    funis,
    enabled: !!fromAtual && !!toAtual,
  });

  // Negocios — previous period
  const { data: negAnterior, isLoading: negLoad2 } = useNegociosBIRpc({
    from: fromAnterior,
    to: toAnterior,
    funis,
    enabled: !!fromAnterior && !!toAnterior,
  });

  // Acoes — current period
  const { data: acoesAtual, isLoading: acoesLoad1 } = useAcoesBIRpc({
    from: fromAtual || undefined,
    to: toAtual || undefined,
    vendedor,
    cidade,
    enabled: true,
  });

  // Acoes — previous period
  const { data: acoesAnterior, isLoading: acoesLoad2 } = useAcoesBIRpc({
    from: fromAnterior || undefined,
    to: toAnterior || undefined,
    vendedor,
    cidade,
    enabled: true,
  });

  // Operacional (single period — no historical comparison available from SQL Server)
  const { agg: opData, isLoading: opLoad } = useOperacionalData(true);

  const kpis = useMemo((): PainelKPIs => {
    const naKpis = negAtual?.kpis;
    const npKpis = negAnterior?.kpis;
    const aaKpis = acoesAtual?.kpis;
    const apKpis = acoesAnterior?.kpis;

    const na = {
      totalNegocios: naKpis?.totalNegocios ?? 0,
      ganhos: naKpis?.ganhos ?? 0,
      perdidos: naKpis?.perdidos ?? 0,
      andamento: naKpis?.andamento ?? 0,
      taxaConversao: naKpis?.taxaConversao ?? 0,
      pipelineAberto: naKpis?.pipelineAberto ?? 0,
      pipelinePerdido: naKpis?.pipelinePerdido ?? 0,
      valorGanho: naKpis?.valorGanho ?? 0,
      ticketMedioGanho: naKpis?.ticketMedioGanho ?? 0,
    };
    const np = {
      totalNegocios: npKpis?.totalNegocios ?? 0,
      ganhos: npKpis?.ganhos ?? 0,
      perdidos: npKpis?.perdidos ?? 0,
      andamento: npKpis?.andamento ?? 0,
      taxaConversao: npKpis?.taxaConversao ?? 0,
      pipelineAberto: npKpis?.pipelineAberto ?? 0,
      pipelinePerdido: npKpis?.pipelinePerdido ?? 0,
      valorGanho: npKpis?.valorGanho ?? 0,
      ticketMedioGanho: npKpis?.ticketMedioGanho ?? 0,
    };
    const aa = {
      totalAcoes: aaKpis?.totalAcoes ?? 0,
      visitas: aaKpis?.visitas ?? 0,
    };
    const ap = {
      totalAcoes: apKpis?.totalAcoes ?? 0,
      visitas: apKpis?.visitas ?? 0,
    };

    // porTipoAcao with previous values
    const tipoAnteriorMap = new Map(
      (acoesAnterior?.porTipoAcao ?? []).map((t) => [t.name, t.value]),
    );
    const porTipoAcao = (acoesAtual?.porTipoAcao ?? []).map((t) => {
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
      totalOS: makeKPI(opData.kpis.eventosAgenda, 0),
      porTipoAcao,
    };
  }, [negAtual, negAnterior, acoesAtual, acoesAnterior, opData]);

  const isLoading = negLoad1 || negLoad2 || acoesLoad1 || acoesLoad2 || opLoad;

  return { kpis, isLoading };
}
