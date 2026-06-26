import { useMemo } from "react";
import { type DateRange } from "react-day-picker";
import { toISODate, getPreviousPeriod, calcTrend } from "@/lib/dateUtils";
import { useServicosBIRpc } from "@/hooks/bi/useServicosBIRpc";
import type { KPIWithPrev, ServicosKPIsResult, UseServicosKPIsReturn } from "@/hooks/bi/useServicosKPIs";

function makeKPI(atual: number, anterior: number): KPIWithPrev {
  return { value: atual, previousValue: anterior, trend: calcTrend(atual, anterior) };
}

/** Inverted: lower current = "up" (good). Used for resolution time. */
function makeKPIInverted(atual: number, anterior: number): KPIWithPrev {
  return { value: atual, previousValue: anterior, trend: calcTrend(anterior, atual) };
}

/**
 * RPC-backed Serviços KPIs with previous-period comparison.
 */
export function useServicosKPIsRpc(
  dateRange: DateRange | undefined,
): UseServicosKPIsReturn {
  const from = toISODate(dateRange?.from) ?? "";
  const to = toISODate(dateRange?.to ?? dateRange?.from) ?? "";

  const prevRange = useMemo(() => getPreviousPeriod(dateRange), [dateRange]);
  const prevFrom = toISODate(prevRange?.from) ?? "";
  const prevTo = toISODate(prevRange?.to ?? prevRange?.from) ?? "";

  const { data: atual, isLoading: l1 } = useServicosBIRpc({ from, to });
  const { data: anterior, isLoading: l2 } = useServicosBIRpc({
    from: prevFrom,
    to: prevTo,
    enabled: !!prevFrom && !!prevTo,
  });

  const kpis: ServicosKPIsResult = atual
    ? {
        osAbertas: makeKPI(atual.kpis.abertas, anterior?.kpis.abertas ?? 0),
        osFechadas: makeKPI(
          atual.kpis.totalOS - atual.kpis.abertas,
          (anterior?.kpis.totalOS ?? 0) - (anterior?.kpis.abertas ?? 0),
        ),
        tempoMedioResolucao: makeKPIInverted(
          atual.kpis.tempoMedioResolucao,
          anterior?.kpis.tempoMedioResolucao ?? 0,
        ),
      }
    : {
        osAbertas: makeKPI(0, 0),
        osFechadas: makeKPI(0, 0),
        tempoMedioResolucao: makeKPI(0, 0),
      };

  return { kpis, isLoading: l1 || l2 };
}
