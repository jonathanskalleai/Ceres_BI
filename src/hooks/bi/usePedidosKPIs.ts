import { useMemo } from "react";
import { type DateRange } from "react-day-picker";
import { usePedidosData } from "@/hooks/bi/usePedidosData";

type Trend = "up" | "down" | "neutral";

export interface KPIWithPrev {
  value: number;
  previousValue: number;
  trend: Trend;
}

export interface PedidosKPIsResult {
  faturamento: KPIWithPrev;
  totalPedidos: KPIWithPrev;
  taxaAprovacao: KPIWithPrev;
  mixFinanciamento: KPIWithPrev;
}

export interface UsePedidosKPIsResult {
  kpis: PedidosKPIsResult;
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
 * Hook for FATURAMENTO section KPIs in BiPainel.
 * Returns 4 KPIs with current/previous period comparison (year-over-year).
 *
 * Reuses usePedidosData which fetches all pedidos once (react-query cached)
 * and filters by dateRange client-side.
 */
export function usePedidosKPIs(
  dateRange: DateRange | undefined,
  _categoria?: string,
  _funil?: string,
): UsePedidosKPIsResult {
  const prevDateRange = useMemo(() => getPreviousDateRange(dateRange), [dateRange]);

  const { agg: aggAtual, isLoading: loadAtual } = usePedidosData(true, dateRange);
  const { agg: aggAnterior, isLoading: loadAnterior } = usePedidosData(true, prevDateRange);

  const kpis = useMemo((): PedidosKPIsResult => {
    return {
      faturamento: makeKPI(aggAtual.kpis.faturamento, aggAnterior.kpis.faturamento),
      totalPedidos: makeKPI(aggAtual.kpis.total, aggAnterior.kpis.total),
      taxaAprovacao: makeKPI(aggAtual.kpis.percentAprovado, aggAnterior.kpis.percentAprovado),
      mixFinanciamento: makeKPI(aggAtual.kpis.percentFinanciado, aggAnterior.kpis.percentFinanciado),
    };
  }, [aggAtual, aggAnterior]);

  return { kpis, isLoading: loadAtual || loadAnterior };
}
