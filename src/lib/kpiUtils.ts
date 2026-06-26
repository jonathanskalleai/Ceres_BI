import { calcTrend, type Trend } from "@/lib/dateUtils";

export type { Trend };

export interface KPIWithPrev {
  value: number;
  previousValue: number;
  trend: Trend;
}

/** Standard KPI: higher current = "up" (good). */
export function makeKPI(atual: number, anterior: number): KPIWithPrev {
  return { value: atual, previousValue: anterior, trend: calcTrend(atual, anterior) };
}

/** Inverted KPI: lower current = "up" (good). Used for cycle time, resolution time, etc. */
export function makeKPIInverted(atual: number, anterior: number): KPIWithPrev {
  return { value: atual, previousValue: anterior, trend: calcTrend(anterior, atual) };
}
