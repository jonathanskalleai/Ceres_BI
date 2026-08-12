import { useMemo } from "react";
import { type DateRange } from "react-day-picker";
import { toISODate, getPreviousPeriod } from "@/lib/dateUtils";
import { makeKPI, makeKPIInverted, type KPIWithPrev } from "@/lib/kpiUtils";
import { type CategoriaFilter, resolveFunis } from "@/lib/categoriaFunil";
import { useNegociosBIRpc } from "@/hooks/bi/useNegociosBIRpc";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { KPIWithPrev };

export interface CrossKPIs {
  cicloMedioVendas: KPIWithPrev;
  esforcoMedio: KPIWithPrev;
}

export interface UseCrossKPIsResult {
  kpis: CrossKPIs;
  isLoading: boolean;
}

/**
 * Indicadores de processo dos negocios, comparados ao periodo anterior.
 * A conversao pedido/negocio foi removida: a base ja contem negocios ganhos,
 * portanto o resultado ficava mecanicamente em 100% e nao media conversao.
 */
export function useCrossKPIsRpc(
  dateRange: DateRange | undefined,
  categoria: CategoriaFilter,
  funil: string,
  vendedor?: string,
  cidade?: string,
): UseCrossKPIsResult {
  const from = toISODate(dateRange?.from) ?? "";
  const to = toISODate(dateRange?.to ?? dateRange?.from) ?? "";
  const funis = resolveFunis(categoria, funil);

  const prevRange = useMemo(() => getPreviousPeriod(dateRange), [dateRange]);
  const prevFrom = toISODate(prevRange?.from) ?? "";
  const prevTo = toISODate(prevRange?.to ?? prevRange?.from) ?? "";

  // Current period
  const { data: negData, isLoading: l1 } = useNegociosBIRpc({ from, to, funis, vendedor, cidade });

  // Previous period
  const { data: negPrev, isLoading: l3 } = useNegociosBIRpc({
    from: prevFrom,
    to: prevTo,
    funis,
    vendedor,
    cidade,
    enabled: !!prevFrom && !!prevTo,
  });

  const kpis = useMemo((): CrossKPIs => {
    if (negData) {
      return {
        cicloMedioVendas: makeKPIInverted(negData.kpis.cicloMedioDias, negPrev?.kpis.cicloMedioDias ?? 0),
        esforcoMedio: makeKPIInverted(negData.kpis.esforcoMedio, negPrev?.kpis.esforcoMedio ?? 0),
      };
    }

    return {
      cicloMedioVendas: makeKPI(0, 0),
      esforcoMedio: makeKPI(0, 0),
    };
  }, [negData, negPrev]);

  return { kpis, isLoading: l1 || l3 };
}
