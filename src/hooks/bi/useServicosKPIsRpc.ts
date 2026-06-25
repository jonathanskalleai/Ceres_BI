import { type DateRange } from "react-day-picker";
import { toISODate } from "@/lib/dateUtils";
import { useServicosBIRpc } from "@/hooks/bi/useServicosBIRpc";
import type { KPIWithPrev, ServicosKPIsResult, UseServicosKPIsReturn } from "@/hooks/bi/useServicosKPIs";

function neutralKPI(value: number): KPIWithPrev {
  return { value, previousValue: 0, trend: "neutral" };
}

/**
 * RPC-backed replacement for useServicosKPIs.
 * Fetches KPIs from rpc_servicos_bi (server-side aggregation).
 *
 * Maps:
 *   kpis.abertas → osAbertas
 *   kpis.totalOS - kpis.abertas → osFechadas (fechadas = total - abertas)
 *   kpis.tempoMedioResolucao → tempoMedioResolucao
 *
 * Trend hardcoded to "neutral" (no previous-period data from RPC).
 */
export function useServicosKPIsRpc(
  dateRange: DateRange | undefined,
): UseServicosKPIsReturn {
  const from = toISODate(dateRange?.from) ?? "";
  const to = toISODate(dateRange?.to ?? dateRange?.from) ?? "";

  const { data, isLoading } = useServicosBIRpc({ from, to });

  const kpis: ServicosKPIsResult = data
    ? {
        osAbertas: neutralKPI(data.kpis.abertas),
        osFechadas: neutralKPI(data.kpis.totalOS - data.kpis.abertas),
        tempoMedioResolucao: neutralKPI(data.kpis.tempoMedioResolucao),
      }
    : {
        osAbertas: neutralKPI(0),
        osFechadas: neutralKPI(0),
        tempoMedioResolucao: neutralKPI(0),
      };

  return { kpis, isLoading };
}
