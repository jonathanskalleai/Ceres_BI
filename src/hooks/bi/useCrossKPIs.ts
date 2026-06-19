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
function toISODate(d: Date | undefined): string | undefined {
  if (!d) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function resolveFunisServer(categoria: CategoriaFilter, funil: string): string[] | undefined {
  if (funil && funil !== FUNIL_ALL) return [funil];
  if (categoria && categoria !== CATEGORIA_ALL) return getFunisByCategoria(categoria);
  return undefined;
}

export function useCrossKPIs(
  dateRange: DateRange | undefined,
  categoria: CategoriaFilter,
  funil: string,
): UseCrossKPIsResult {
  const prevDateRange = useMemo(() => getPreviousDateRange(dateRange), [dateRange]);

  const fromAtual = toISODate(dateRange?.from);
  const toAtual = toISODate(dateRange?.to ?? dateRange?.from);
  const fromPrev = toISODate(prevDateRange?.from);
  const toPrev = toISODate(prevDateRange?.to ?? prevDateRange?.from);
  const funisServer = resolveFunisServer(categoria, funil);

  // Current period — filtered server-side, shares cache with useNegociosBI/usePedidosData
  const { data: negociosAtualRaw = [], isLoading: negLoadA } = useQuery<NegocioBIRow[]>({
    queryKey: ["bi-negocios", fromAtual ?? null, toAtual ?? null, funisServer ?? null],
    queryFn: () => fetchNegociosBI({ from: fromAtual, to: toAtual, funis: funisServer }),
    staleTime: 5 * 60_000,
  });

  const { data: pedidosAtualRaw = [], isLoading: pedLoadA } = useQuery<PedidoRow[]>({
    queryKey: ["bi-pedidos", fromAtual ?? null, toAtual ?? null],
    queryFn: () => fetchPedidosBI({ from: fromAtual, to: toAtual }),
    staleTime: 5 * 60_000,
  });

  // Previous period
  const { data: negociosPrevRaw = [], isLoading: negLoadP } = useQuery<NegocioBIRow[]>({
    queryKey: ["bi-negocios", fromPrev ?? null, toPrev ?? null, funisServer ?? null],
    queryFn: () => fetchNegociosBI({ from: fromPrev, to: toPrev, funis: funisServer }),
    staleTime: 5 * 60_000,
  });

  const { data: pedidosPrevRaw = [], isLoading: pedLoadP } = useQuery<PedidoRow[]>({
    queryKey: ["bi-pedidos", fromPrev ?? null, toPrev ?? null],
    queryFn: () => fetchPedidosBI({ from: fromPrev, to: toPrev }),
    staleTime: 5 * 60_000,
  });

  const kpis = useMemo((): CrossKPIs => {
    // Server-side filter already applied; still apply local funil/categoria for safety + dedup
    const negAtual = filterNegocios(negociosAtualRaw, undefined, categoria, funil);
    const negAnterior = filterNegocios(negociosPrevRaw, undefined, categoria, funil);
    const metricsAtual = computeMetrics(negAtual, pedidosAtualRaw);
    const metricsAnterior = computeMetrics(negAnterior, pedidosPrevRaw);

    return {
      cicloMedioVendas: makeKPI(metricsAtual.cicloMedioDias, metricsAnterior.cicloMedioDias, true),
      esforcoMedio: makeKPI(metricsAtual.esforcoMedio, metricsAnterior.esforcoMedio, true),
      conversaoPedidoNegocio: makeKPI(metricsAtual.conversaoPedido, metricsAnterior.conversaoPedido),
      receitaPorConsultor: makeKPI(metricsAtual.receitaPorConsultor, metricsAnterior.receitaPorConsultor),
    };
  }, [negociosAtualRaw, pedidosAtualRaw, negociosPrevRaw, pedidosPrevRaw, categoria, funil]);

  return { kpis, isLoading: negLoadA || pedLoadA || negLoadP || pedLoadP };
}
