import { useMemo } from "react";
import { useTheme } from "@/hooks/useTheme";
import {
  getChartThemeVars,
  buildGlassTooltip,
  buildCategoryAxis,
  buildValueAxis,
  type ChartThemeVars,
} from "@/lib/chartTheme";
import type { EChartsOption } from "echarts";

/**
 * Hook que retorna os tokens de tema para charts baseado no dark/light mode atual.
 * Cada chart component usa este hook para obter tooltip, eixos e vars corretos.
 */
export function useChartTheme() {
  const { isDark } = useTheme();

  const vars = useMemo<ChartThemeVars>(() => getChartThemeVars(isDark), [isDark]);

  const tooltip = useMemo<EChartsOption["tooltip"]>(
    () => buildGlassTooltip(vars),
    [vars],
  );

  const categoryAxis = useMemo(() => buildCategoryAxis(vars), [vars]);
  const valueAxis = useMemo(() => buildValueAxis(vars), [vars]);

  return { isDark, vars, tooltip, categoryAxis, valueAxis } as const;
}
