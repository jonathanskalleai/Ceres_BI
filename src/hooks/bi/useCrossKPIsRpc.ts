import { useMemo } from "react";
import { type DateRange } from "react-day-picker";
import { toISODate, getPreviousPeriod } from "@/lib/dateUtils";
import { makeKPI, makeKPIInverted, type KPIWithPrev } from "@/lib/kpiUtils";
import { type CategoriaFilter, resolveFunis } from "@/lib/categoriaFunil";
import { useNegociosBIRpc } from "@/hooks/bi/useNegociosBIRpc";
import { usePedidosBIRpc } from "@/hooks/bi/usePedidosBIRpc";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { KPIWithPrev };

export interface CrossKPIs {
  cicloMedioVendas: KPIWithPrev;
  esforcoMedio: KPIWithPrev;
  conversaoPedidoNegocio: KPIWithPrev;
  receitaPorConsultor: KPIWithPrev;
}

export interface UseCrossKPIsResult {
  kpis: CrossKPIs;
  isLoading: boolean;
}

/**
 * RPC-backed Cross KPIs with previous-period comparison.
 * Computes cross-KPIs from rpc_negocios_bi + rpc_pedidos_bi.
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
  const { data: pedData, isLoading: l2 } = usePedidosBIRpc({ from, to, vendedor, cidade });

  // Previous period
  const { data: negPrev, isLoading: l3 } = useNegociosBIRpc({
    from: prevFrom,
    to: prevTo,
    funis,
    vendedor,
    cidade,
    enabled: !!prevFrom && !!prevTo,
  });
  const { data: pedPrev, isLoading: l4 } = usePedidosBIRpc({
    from: prevFrom,
    to: prevTo,
    vendedor,
    cidade,
    enabled: !!prevFrom && !!prevTo,
  });

  const kpis = useMemo((): CrossKPIs => {
    if (negData && pedData) {
      const ganhos = negData.kpis.ganhos || 1;
      const conversao = Math.min((pedData.kpis.total / ganhos) * 100, 100);
      const consultores = negData.rankingConsultor?.length || 1;
      const receitaPorConsultor = negData.kpis.valorGanho / consultores;

      // Previous values
      const prevGanhos = negPrev?.kpis.ganhos || 1;
      const prevConversao = Math.min(((pedPrev?.kpis.total ?? 0) / prevGanhos) * 100, 100);
      const prevConsultores = negPrev?.rankingConsultor?.length || 1;
      const prevReceita = (negPrev?.kpis.valorGanho ?? 0) / prevConsultores;

      return {
        cicloMedioVendas: makeKPIInverted(negData.kpis.cicloMedioDias, negPrev?.kpis.cicloMedioDias ?? 0),
        esforcoMedio: makeKPIInverted(negData.kpis.esforcoMedio, negPrev?.kpis.esforcoMedio ?? 0),
        conversaoPedidoNegocio: makeKPI(conversao, prevConversao),
        receitaPorConsultor: makeKPI(receitaPorConsultor, prevReceita),
      };
    }

    return {
      cicloMedioVendas: makeKPI(0, 0),
      esforcoMedio: makeKPI(0, 0),
      conversaoPedidoNegocio: makeKPI(0, 0),
      receitaPorConsultor: makeKPI(0, 0),
    };
  }, [negData, pedData, negPrev, pedPrev]);

  return { kpis, isLoading: l1 || l2 || l3 || l4 };
}
