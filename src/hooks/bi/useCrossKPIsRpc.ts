import { type DateRange } from "react-day-picker";
import { toISODate } from "@/lib/dateUtils";
import { type CategoriaFilter, CATEGORIA_ALL, getFunisByCategoria, FUNIL_ALL } from "@/lib/categoriaFunil";
import { useNegociosBIRpc } from "@/hooks/bi/useNegociosBIRpc";
import { usePedidosBIRpc } from "@/hooks/bi/usePedidosBIRpc";

// ---------------------------------------------------------------------------
// Types (migrated from useCrossKPIs.ts — canonical source now)
// ---------------------------------------------------------------------------

type Trend = "up" | "down" | "neutral";

export interface KPIWithPrev {
  value: number;
  previousValue: number;
  trend: Trend;
}

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

function neutralKPI(value: number): KPIWithPrev {
  return { value, previousValue: 0, trend: "neutral" };
}

function resolveFunis(categoria: CategoriaFilter, funil: string): string[] | undefined {
  if (funil && funil !== FUNIL_ALL) return [funil];
  if (categoria && categoria !== CATEGORIA_ALL) return getFunisByCategoria(categoria);
  return undefined;
}

/**
 * RPC-backed replacement for useCrossKPIs.
 * Computes cross-KPIs from rpc_negocios_bi + rpc_pedidos_bi server-side data.
 *
 * Maps:
 *   negocios.kpis.cicloMedioDias → cicloMedioVendas
 *   negocios.kpis.esforcoMedio → esforcoMedio
 *   pedidos.kpis.total / negocios.kpis.ganhos → conversaoPedidoNegocio (approx %)
 *   negocios.kpis.valorGanho / rankingConsultor.length → receitaPorConsultor
 *
 * Trend hardcoded to "neutral" (no previous-period comparison from RPC).
 */
export function useCrossKPIsRpc(
  dateRange: DateRange | undefined,
  categoria: CategoriaFilter,
  funil: string,
): UseCrossKPIsResult {
  const from = toISODate(dateRange?.from) ?? "";
  const to = toISODate(dateRange?.to ?? dateRange?.from) ?? "";
  const funis = resolveFunis(categoria, funil);

  const { data: negData, isLoading: negLoading } = useNegociosBIRpc({ from, to, funis });
  const { data: pedData, isLoading: pedLoading } = usePedidosBIRpc({ from, to });

  let kpis: CrossKPIs;

  if (negData && pedData) {
    const ganhos = negData.kpis.ganhos || 1; // avoid division by zero
    const conversao = (pedData.kpis.total / ganhos) * 100;
    const consultores = negData.rankingConsultor?.length || 1;
    const receitaPorConsultor = negData.kpis.valorGanho / consultores;

    kpis = {
      cicloMedioVendas: neutralKPI(negData.kpis.cicloMedioDias),
      esforcoMedio: neutralKPI(negData.kpis.esforcoMedio),
      conversaoPedidoNegocio: neutralKPI(Math.min(conversao, 100)),
      receitaPorConsultor: neutralKPI(receitaPorConsultor),
    };
  } else {
    kpis = {
      cicloMedioVendas: neutralKPI(0),
      esforcoMedio: neutralKPI(0),
      conversaoPedidoNegocio: neutralKPI(0),
      receitaPorConsultor: neutralKPI(0),
    };
  }

  return { kpis, isLoading: negLoading || pedLoading };
}
