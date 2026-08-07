import { useMemo } from "react";
import { type DateRange } from "react-day-picker";
import { useQuery } from "@tanstack/react-query";
import { fetchOrdensServico, type OrdemServicoRow } from "@/services/bi/servicosBIService";
import { daysBetween } from "@/lib/dateUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Trend = "up" | "down" | "neutral";

export interface KPIWithPrev {
  value: number;
  previousValue: number;
  trend: Trend;
}

export interface ServicosKPIsResult {
  osAbertas: KPIWithPrev;
  osFechadas: KPIWithPrev;
  tempoMedioResolucao: KPIWithPrev; // invertTrend: lower is better
}

export interface UseServicosKPIsReturn {
  kpis: ServicosKPIsResult;
  isLoading: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcTrend(atual: number, anterior: number): Trend {
  if (atual > anterior) return "up";
  if (atual < anterior) return "down";
  return "neutral";
}

function calcTrendInverted(atual: number, anterior: number): Trend {
  // Lower is better — invert the direction
  if (atual < anterior) return "up";
  if (atual > anterior) return "down";
  return "neutral";
}

function makeKPI(atual: number, anterior: number): KPIWithPrev {
  return { value: atual, previousValue: anterior, trend: calcTrend(atual, anterior) };
}

function makeKPIInverted(atual: number, anterior: number): KPIWithPrev {
  return { value: atual, previousValue: anterior, trend: calcTrendInverted(atual, anterior) };
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

function isInRange(dateStr: string | null, range: DateRange | undefined): boolean {
  if (!dateStr || !range?.from) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  if (d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}

function isFechada(row: OrdemServicoRow): boolean {
  const sit = (row.SIT_dscSituacaoOS ?? "").toLowerCase().trim();
  const status = (row.OS_fStatus ?? "").toLowerCase().trim();
  return (
    sit.includes("encerrad") ||
    sit.includes("fechad") ||
    status.includes("fechad") ||
    status.includes("encerrad")
  );
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

interface PeriodMetrics {
  abertas: number;
  fechadas: number;
  tempoMedioResolucao: number;
}

function computeMetrics(
  rows: OrdemServicoRow[],
  dateRange: DateRange | undefined,
): PeriodMetrics {
  let abertas = 0;
  let fechadas = 0;
  const resolucoes: number[] = [];

  for (const row of rows) {
    const aberturaInRange = isInRange(row.OS_dthAbertura, dateRange);

    if (aberturaInRange && !isFechada(row)) {
      abertas++;
    }

    // OS fechadas: encerramento dentro do período
    const encerramentoInRange = isInRange(row.OS_dthEncerramento, dateRange);
    if (encerramentoInRange && isFechada(row)) {
      fechadas++;
      const dias = daysBetween(row.OS_dthAbertura, row.OS_dthEncerramento);
      if (dias != null && dias >= 0) {
        resolucoes.push(dias);
      }
    }
  }

  const avgResolucao =
    resolucoes.length > 0
      ? resolucoes.reduce((sum, d) => sum + d, 0) / resolucoes.length
      : 0;

  return {
    abertas,
    fechadas,
    tempoMedioResolucao: Math.round(avgResolucao * 10) / 10,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useServicosKPIs(
  dateRange: DateRange | undefined,
): UseServicosKPIsReturn {
  const { data: allOrdens, isLoading } = useQuery({
    queryKey: ["bi-os"],
    queryFn: () => fetchOrdensServico(),
    staleTime: 60_000,
  });

  const prevDateRange = useMemo(() => getPreviousDateRange(dateRange), [dateRange]);

  const kpis = useMemo((): ServicosKPIsResult => {
    const rows = allOrdens ?? [];

    const atual = computeMetrics(rows, dateRange);
    const anterior = computeMetrics(rows, prevDateRange);

    return {
      osAbertas: makeKPI(atual.abertas, anterior.abertas),
      osFechadas: makeKPI(atual.fechadas, anterior.fechadas),
      tempoMedioResolucao: makeKPIInverted(
        atual.tempoMedioResolucao,
        anterior.tempoMedioResolucao,
      ),
    };
  }, [allOrdens, dateRange, prevDateRange]);

  return { kpis, isLoading };
}
