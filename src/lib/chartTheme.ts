import type { EChartsOption } from "echarts";

/**
 * Tema central dos graficos do BI (ECharts). Define a paleta, os gradientes
 * (estetica glass/transparencia), o tooltip "vidro" e helpers de formatacao.
 * Suporta dark/light mode via getChartThemeVars().
 */

// VOUX palette — champagne/ink editorial (light-mode strong, legível em fundo claro)
export const CHART_COLORS = [
  "#8a4a14", // primary (champagne escurecido)
  "#1f6e3f", // success (verde profundo)
  "#9c5e1c", // warning (âmbar denso)
  "#1d4f8a", // info (azul aço)
  "#b8421c", // danger (terracota forte)
  "#6a2f99", // accent secundário (roxo poeira)
  "#2f5c52", // sage profundo
  "#7a4a2a", // warm muted (cobre)
] as const;

export const ACCENT_COLOR = "#8a4a14";
export const POSITIVE_COLOR = "#1f6e3f";
export const NEGATIVE_COLOR = "#b8421c";

// ----- Dark/Light theme vars for charts -----

export interface ChartThemeVars {
  axisText: string;
  gridLine: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  legendText: string;
}

export function getChartThemeVars(isDark: boolean): ChartThemeVars {
  if (isDark) {
    return {
      axisText: "#b3ab9c",       // ink-200
      gridLine: "rgba(214, 207, 193, 0.07)",
      tooltipBg: "rgba(17, 16, 13, 0.96)",  // ink-900
      tooltipBorder: "rgba(212, 184, 150, 0.15)",
      tooltipText: "#ece5d4",    // ink-50
      legendText: "#b3ab9c",
    };
  }
  return {
    axisText: "#524a3e",         // ink-500
    gridLine: "rgba(82, 74, 62, 0.1)",
    tooltipBg: "rgba(10, 9, 7, 0.92)",
    tooltipBorder: "rgba(212, 184, 150, 0.2)",
    tooltipText: "#ece5d4",
    legendText: "#524a3e",
  };
}

/** Converte hex (#rrggbb) em rgba com alpha. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Gradiente linear translucido para preenchimento de barra/area. */
export function gradientFill(
  color: string,
  direction: "vertical" | "horizontal" = "vertical",
  from = 1.0,
  to = 1.0,
) {
  const coords =
    direction === "vertical"
      ? { x: 0, y: 0, x2: 0, y2: 1 }
      : { x: 0, y: 0, x2: 1, y2: 0 };
  return {
    type: "linear" as const,
    ...coords,
    colorStops: [
      { offset: 0, color: withAlpha(color, from) },
      { offset: 1, color: withAlpha(color, to) },
    ],
  };
}

/** Formata numeros grandes de forma compacta (1.2 mil, 3,4 mi). */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Tooltip "vidro" — usa vars do tema. */
export function buildGlassTooltip(vars: ChartThemeVars): EChartsOption["tooltip"] {
  return {
    backgroundColor: vars.tooltipBg,
    borderColor: vars.tooltipBorder,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: vars.tooltipText, fontSize: 12 },
    extraCssText:
      "backdrop-filter: blur(10px); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.35);",
  };
}

/** Tooltip estático (light mode default) para backward compat. */
export const glassTooltip: EChartsOption["tooltip"] = buildGlassTooltip(
  getChartThemeVars(false),
);

/** HTML interno do tooltip com bolinha de cor. */
export function tooltipRow(
  name: string,
  seriesLabel: string,
  color: string,
  formattedValue: string,
): string {
  return `<div>
    <div style="font-size:12px;color:var(--voux-text-muted);margin-bottom:4px">${name}</div>
    <div style="display:flex;align-items:center;gap:6px">
      <span style="width:8px;height:8px;border-radius:9999px;background:${color};display:inline-block;flex-shrink:0"></span>
      <span style="font-size:13px;color:var(--voux-text-primary)">${seriesLabel ? `${seriesLabel}: ` : ""}<strong>${formattedValue}</strong></span>
    </div>
  </div>`;
}

/** Eixo de categoria minimalista (sem linha de eixo, label suave). */
export function buildCategoryAxis(vars: ChartThemeVars) {
  return {
    type: "category" as const,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: vars.axisText, fontSize: 12 },
  };
}

/** Eixo de valor minimalista (grid lines quase invisíveis). */
export function buildValueAxis(vars: ChartThemeVars) {
  return {
    type: "value" as const,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: vars.axisText, fontSize: 12 },
    splitLine: {
      show: true,
      lineStyle: { color: vars.gridLine, type: "solid" as const },
    },
  };
}

// Static defaults for backward compat (light mode)
export const categoryAxisBase = buildCategoryAxis(getChartThemeVars(false));
export const valueAxisBase = buildValueAxis(getChartThemeVars(false));

/** Opcoes base de animacao compartilhadas. */
export const baseAnimation = {
  animation: true,
  animationDuration: 450,
  animationEasing: "quartOut" as const,
};
