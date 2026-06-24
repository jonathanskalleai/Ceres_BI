import { type DateRange } from "react-day-picker";
import { toISODate } from "@/lib/dateUtils";
import { usePedidosBIRpc } from "@/hooks/bi/usePedidosBIRpc";

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

function neutralKPI(value: number): KPIWithPrev {
  return { value, previousValue: 0, trend: "neutral" };
}

/**
 * RPC-backed replacement for usePedidosKPIs.
 * Fetches KPIs from rpc_pedidos_bi (server-side aggregation) instead of
 * pulling all rows and computing client-side.
 *
 * Trend is hardcoded to "neutral" since RPCs don't return previous-period data yet.
 */
export function usePedidosKPIsRpc(
  dateRange: DateRange | undefined,
  _categoria?: string,
  _funil?: string,
): UsePedidosKPIsResult {
  const from = toISODate(dateRange?.from) ?? "";
  const to = toISODate(dateRange?.to ?? dateRange?.from) ?? "";

  const { data, isLoading } = usePedidosBIRpc({ from, to });

  const kpis: PedidosKPIsResult = data
    ? {
        faturamento: neutralKPI(data.kpis.faturamento),
        totalPedidos: neutralKPI(data.kpis.total),
        taxaAprovacao: neutralKPI(data.kpis.percentAprovado),
        mixFinanciamento: neutralKPI(data.kpis.percentFinanciado),
      }
    : {
        faturamento: neutralKPI(0),
        totalPedidos: neutralKPI(0),
        taxaAprovacao: neutralKPI(0),
        mixFinanciamento: neutralKPI(0),
      };

  return { kpis, isLoading };
}
