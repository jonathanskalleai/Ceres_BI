import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { type DateRange } from "react-day-picker";
import { type CategoriaFilter, CATEGORIA_ALL, getFunisByCategoria, FUNIL_ALL } from "@/lib/categoriaFunil";
import { fetchNegociosBI, type NegocioBIRow } from "@/services/bi/negociosBIService";
import { fetchPedidosBI, type PedidoRow } from "@/services/bi/pedidosBIService";
import { dedupeNegocios } from "@/hooks/bi/useNegociosBI";

// ---------------------------------------------------------------------------
// Types
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcTrend(atual: number, anterior: number, invertTrend = false): Trend {
  if (atual === anterior) return "neutral";
  const isUp = atual > anterior;
  if (invertTrend) return isUp ? "down" : "up";
  return isUp ? "up" : "down";
}

function makeKPI(atual: number, anterior: number, invertTrend = false): KPIWithPrev {
  return {
    value: atual,
    previousValue: anterior,
    trend: calcTrend(atual, anterior, invertTrend),
  };
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

const num = (v: number | null): number => (typeof v === "number" && isFinite(v) ? v : 0);

function isGanho(conclusao: string | null): boolean {
  return (conclusao ?? "").toLowerCase().includes("ganho");
}

// ---------------------------------------------------------------------------
// Filtering helpers (mirror useNegociosBI / usePedidosData logic)
// ---------------------------------------------------------------------------

function filterNegocios(
  rows: NegocioBIRow[],
  dateRange: DateRange | undefined,
  categoria: CategoriaFilter,
  funil: string,
): NegocioBIRow[] {
  let result = dedupeNegocios(rows);

  if (funil && funil !== FUNIL_ALL) {
    result = result.filter((r) => r.NGO_Funil === funil);
  } else if (categoria && categoria !== CATEGORIA_ALL) {
    const funis = getFunisByCategoria(categoria);
    result = result.filter((r) => funis.includes(r.NGO_Funil ?? ""));
  }

  if (dateRange?.from) {
    result = result.filter((r) => {
      const d = r.NGO_DataFechamento ? new Date(r.NGO_DataFechamento) : null;
      if (!d) return false;
      if (dateRange.from && d < dateRange.from) return false;
      if (dateRange.to && d > dateRange.to) return false;
      return true;
    });
  }

  return result;
}

function filterPedidos(rows: PedidoRow[], dateRange: DateRange | undefined): PedidoRow[] {
  if (!dateRange?.from) return rows;
  return rows.filter((r) => {
    const d = r.PDO_DthPedido ? new Date(r.PDO_DthPedido) : null;
    if (!d) return false;
    if (dateRange.from && d < dateRange.from) return false;
    if (dateRange.to && d > dateRange.to) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

interface PeriodMetrics {
  cicloMedioDias: number;
  esforcoMedio: number;
  conversaoPedido: number;
  receitaPorConsultor: number;
}

function computeMetrics(negocios: NegocioBIRow[], pedidos: PedidoRow[]): PeriodMetrics {
  const ganhos = negocios.filter((r) => isGanho(r.NGO_Conclusao));

  // 1. Ciclo medio de vendas (negocios ganhos com ciclo > 0)
  let cicloSoma = 0;
  let cicloN = 0;
  for (const r of ganhos) {
    const ciclo = num(r.NGO_CicloVendas);
    if (ciclo > 0) {
      cicloSoma += ciclo;
      cicloN++;
    }
  }
  const cicloMedioDias = cicloN > 0 ? cicloSoma / cicloN : 0;

  // 2. Esforco medio (qtd acoes nos negocios ganhos com acoes > 0)
  let esforcoSoma = 0;
  let esforcoN = 0;
  for (const r of ganhos) {
    const acoes = num(r.NGO_QtdAcoes);
    if (acoes > 0) {
      esforcoSoma += acoes;
      esforcoN++;
    }
  }
  const esforcoMedio = esforcoN > 0 ? esforcoSoma / esforcoN : 0;

  // 3. Conversao pedido/negocio: % dos negocios ganhos com pelo menos 1 pedido
  const ganhosNgoSet = new Set(ganhos.map((r) => r.NGO_Numero));
  const pedidosComNegocioGanho = new Set<string>();
  for (const p of pedidos) {
    if (p.NGO_Numero && ganhosNgoSet.has(p.NGO_Numero)) {
      pedidosComNegocioGanho.add(p.NGO_Numero);
    }
  }
  const conversaoPedido =
    ganhosNgoSet.size > 0
      ? (pedidosComNegocioGanho.size / ganhosNgoSet.size) * 100
      : 0;

  // 4. Receita por consultor: SUM(valorGanho) / COUNT(DISTINCT vendedores com ganho)
  const vendedorValor = new Map<string, number>();
  for (const r of ganhos) {
    const vendedor = r.vendedorNome || "Sem vendedor";
    vendedorValor.set(vendedor, (vendedorValor.get(vendedor) ?? 0) + num(r.NGO_VlrTotalNegociado));
  }
  const totalValorGanho = ganhos.reduce((sum, r) => sum + num(r.NGO_VlrTotalNegociado), 0);
  const vendedoresAtivos = vendedorValor.size;
  const receitaPorConsultor = vendedoresAtivos > 0 ? totalValorGanho / vendedoresAtivos : 0;

  return { cicloMedioDias, esforcoMedio, conversaoPedido, receitaPorConsultor };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Cross-KPIs that require JOIN between negocios and pedidos tables.
 * Uses react-query shared cache (same query keys as useNegociosBI/usePedidosData).
 *
 * Returns:
 * - cicloMedioVendas: AVG days to close (ganhos only, invertTrend: lower=better)
 * - esforcoMedio: AVG actions per deal (ganhos only, invertTrend: lower=better)
 * - conversaoPedidoNegocio: % of won deals that generated at least 1 order
 * - receitaPorConsultor: AVG revenue per active seller (won deals)
 */
export function useCrossKPIs(
  dateRange: DateRange | undefined,
  categoria: CategoriaFilter,
  funil: string,
): UseCrossKPIsResult {
  const prevDateRange = useMemo(() => getPreviousDateRange(dateRange), [dateRange]);

  // Share cache with useNegociosBI (key: ["bi-negocios"])
  const { data: negociosRaw = [], isLoading: negLoad } = useQuery({
    queryKey: ["bi-negocios"],
    queryFn: fetchNegociosBI,
    staleTime: 60_000,
  });

  // Share cache with usePedidosData (key: ["bi-pedidos"])
  const { data: pedidosRaw = [], isLoading: pedLoad } = useQuery({
    queryKey: ["bi-pedidos"],
    queryFn: fetchPedidosBI,
    staleTime: 60_000,
  });

  const kpis = useMemo((): CrossKPIs => {
    // Current period
    const negAtual = filterNegocios(negociosRaw, dateRange, categoria, funil);
    const pedAtual = filterPedidos(pedidosRaw, dateRange);
    const metricsAtual = computeMetrics(negAtual, pedAtual);

    // Previous period (year-over-year)
    const negAnterior = filterNegocios(negociosRaw, prevDateRange, categoria, funil);
    const pedAnterior = filterPedidos(pedidosRaw, prevDateRange);
    const metricsAnterior = computeMetrics(negAnterior, pedAnterior);

    return {
      cicloMedioVendas: makeKPI(metricsAtual.cicloMedioDias, metricsAnterior.cicloMedioDias, true),
      esforcoMedio: makeKPI(metricsAtual.esforcoMedio, metricsAnterior.esforcoMedio, true),
      conversaoPedidoNegocio: makeKPI(metricsAtual.conversaoPedido, metricsAnterior.conversaoPedido),
      receitaPorConsultor: makeKPI(metricsAtual.receitaPorConsultor, metricsAnterior.receitaPorConsultor),
    };
  }, [negociosRaw, pedidosRaw, dateRange, prevDateRange, categoria, funil]);

  return { kpis, isLoading: negLoad || pedLoad };
}
