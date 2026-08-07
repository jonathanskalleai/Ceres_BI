import { useMemo } from "react";
import { type DateRange } from "react-day-picker";
import { toISODate, getPreviousPeriod } from "@/lib/dateUtils";
import { makeKPI, type KPIWithPrev } from "@/lib/kpiUtils";
import { usePedidosBIRpc } from "@/hooks/bi/usePedidosBIRpc";

export type { KPIWithPrev };

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

/**
 * RPC-backed Pedidos KPIs with previous-period comparison.
 */
export function usePedidosKPIsRpc(
  dateRange: DateRange | undefined,
  _categoria?: string,
  _funil?: string,
  vendedor?: string,
  cidade?: string,
): UsePedidosKPIsResult {
  const from = toISODate(dateRange?.from) ?? "";
  const to = toISODate(dateRange?.to ?? dateRange?.from) ?? "";

  const prevRange = useMemo(() => getPreviousPeriod(dateRange), [dateRange]);
  const prevFrom = toISODate(prevRange?.from) ?? "";
  const prevTo = toISODate(prevRange?.to ?? prevRange?.from) ?? "";

  const { data: atual, isLoading: l1 } = usePedidosBIRpc({ from, to, vendedor, cidade });
  const { data: anterior, isLoading: l2 } = usePedidosBIRpc({
    from: prevFrom,
    to: prevTo,
    vendedor,
    cidade,
    enabled: !!prevFrom && !!prevTo,
  });

  const kpis: PedidosKPIsResult = atual
    ? {
        faturamento: makeKPI(atual.kpis.faturamento, anterior?.kpis.faturamento ?? 0),
        totalPedidos: makeKPI(atual.kpis.total, anterior?.kpis.total ?? 0),
        taxaAprovacao: makeKPI(atual.kpis.percentAprovado, anterior?.kpis.percentAprovado ?? 0),
        mixFinanciamento: makeKPI(atual.kpis.percentFinanciado, anterior?.kpis.percentFinanciado ?? 0),
      }
    : {
        faturamento: makeKPI(0, 0),
        totalPedidos: makeKPI(0, 0),
        taxaAprovacao: makeKPI(0, 0),
        mixFinanciamento: makeKPI(0, 0),
      };

  return { kpis, isLoading: l1 || l2 };
}
