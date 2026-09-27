import { type DateRange } from "react-day-picker";
import { useServicosKPIsRpc } from "@/hooks/bi/useServicosKPIsRpc";

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
  comparisonReady: boolean;
}

/**
 * Compatibility hook for older consumers. The former implementation fetched
 * up to 50,000 mirror rows and recomputed KPIs in React. Keep this public name
 * for rollback, but use the same PostgreSQL/API contract as the active panel.
 */
export function useServicosKPIs(
  dateRange: DateRange | undefined,
  cidade?: string,
): UseServicosKPIsReturn {
  return useServicosKPIsRpc(dateRange, cidade);
}
