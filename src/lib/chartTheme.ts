import type { EChartsOption } from "echarts";

/**
 * Tema central dos gráficos do BI (ECharts). Define a paleta, os gradientes
 * (estética glass/transparência), o tooltip "vidro" e helpers de formatação.
 * Substitui o antigo nivoTheme.ts.
 */

// Paleta moderna — mantém a semântica do sistema antigo (1º dourado, 2º azul,
// 3º verde...) para não quebrar os `CHART_COLORS[i]` espalhados nas seções.
export const CHART_COLORS = [
  "#f0b429", // dourado
  "#3b82f6", // azul
  "#10b981", // verde esmeralda
  "#f97316", // laranja
  "#8b5cf6", // roxo
  "#ef4444", // vermelho
  "#06b6d4", // ciano
  "#ec4899", // rosa
] as const;

export const POSITIVE_COLOR = "#10b981";
export const NEGATIVE_COLOR = "#ef4444";

const AXIS_TEXT = "#64748b";
const GRID_LINE = "rgba(100, 116, 139, 0.18)";

/** Converte hex (#rrggbb) em rgba com alpha. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Gradiente linear translúcido para preenchimento de barra/área. */
export function gradientFill(
  color: string,
  direction: "vertical" | "horizontal" = "vertical",
  from = 0.95,
  to = 0.35,
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

/** Formata números grandes de forma compacta (1.2 mil, 3,4 mi) p/ não cortar eixo. */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Tooltip "vidro" — fundo escuro translúcido + blur. */
export const glassTooltip: EChartsOption["tooltip"] = {
  backgroundColor: "rgba(15, 23, 42, 0.92)",
  borderColor: "rgba(255, 255, 255, 0.12)",
  borderWidth: 1,
  padding: [8, 12],
  textStyle: { color: "#f1f5f9", fontSize: 12 },
  extraCssText:
    "backdrop-filter: blur(10px); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.35);",
};

/** HTML interno do tooltip com bolinha de cor — estilo consistente entre charts. */
export function tooltipRow(
  name: string,
  seriesLabel: string,
  color: string,
  formattedValue: string,
): string {
  return `<div>
    <div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${name}</div>
    <div style="display:flex;align-items:center;gap:6px">
      <span style="width:8px;height:8px;border-radius:9999px;background:${color};display:inline-block;flex-shrink:0"></span>
      <span style="font-size:13px;color:#f1f5f9">${seriesLabel ? `${seriesLabel}: ` : ""}<strong>${formattedValue}</strong></span>
    </div>
  </div>`;
}

/** Eixo de categoria minimalista (sem linha de eixo, label suave). */
export const categoryAxisBase = {
  type: "category" as const,
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: AXIS_TEXT, fontSize: 11 },
};

/** Eixo de valor minimalista (linhas de grade tracejadas bem sutis). */
export const valueAxisBase = {
  type: "value" as const,
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: AXIS_TEXT, fontSize: 11 },
  splitLine: {
    show: true,
    lineStyle: { color: GRID_LINE, type: "dashed" as const },
  },
};

/** Opções base de animação compartilhadas. */
export const baseAnimation = {
  animation: true,
  animationDuration: 600,
  animationEasing: "cubicOut" as const,
};
