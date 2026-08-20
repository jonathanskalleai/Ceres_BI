import { useRef, useState, useCallback } from "react";
import { ChartFrame } from "./ChartFrame";
import { SvgBarH } from "./primitives/SvgBarH";
import { SvgBarV } from "./primitives/SvgBarV";
import { useContainerWidth } from "./primitives/useContainerWidth";
import { getVouxPalette } from "./primitives/svgGeometry";
import { useTheme } from "@/hooks/useTheme";
import {
  BarChartTooltip,
  SeriesLabel,
  resolveColor,
  buildTooltipContent,
  INITIAL_TOOLTIP,
  type TooltipState,
} from "./barChartHelpers";

export interface BarChartData {
  name: string;
  [key: string]: string | number;
}

export interface BarChartProps {
  data: BarChartData[];
  layout?: "horizontal" | "vertical";
  keys: string[];
  colors?: readonly string[];
  /** Cor individual por dataIndex — sobrescreve `colors` quando definido */
  itemColors?: string[];
  title?: string;
  /** Labels amigáveis para cada key */
  seriesLabels?: Record<string, string>;
  height?: number;
  loading?: boolean;
  tooltipFormatter?: (value: number, datum?: BarChartData) => string;
  groupMode?: "grouped" | "stacked";
  onBarClick?: (datum: BarChartData, index: number) => void;
  /**
   * Conteudo HTML do tooltip, quando o rotulo da barra nao basta para explicar
   * o dado (ex: ranking com 4 metricas por consultor). Separado de
   * `tooltipFormatter` de proposito: aquele tambem formata o rotulo DENTRO do
   * SVG, onde HTML apareceria como texto literal.
   * O chamador e responsavel por escapar o que vier de dados.
   */
  tooltipContentFormatter?: (datum: BarChartData, value: number, keyLabel: string) => string;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function BarChart({
  data,
  layout = "vertical",
  keys,
  colors,
  itemColors,
  seriesLabels,
  height,
  loading = false,
  tooltipFormatter,
  groupMode = "grouped",
  onBarClick,
  tooltipContentFormatter,
}: BarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(containerRef as React.RefObject<HTMLElement>);
  const { isDark } = useTheme();
  const palette = colors ?? getVouxPalette(isDark);

  const [tooltip, setTooltip] = useState<TooltipState>(INITIAL_TOOLTIP);

  const fmt = useCallback(
    (v: number, datum?: BarChartData) =>
      tooltipFormatter ? tooltipFormatter(v, datum) : v.toLocaleString("pt-BR"),
    [tooltipFormatter],
  );

  const isEmpty = data.length === 0;

  // Treat width=0 as "still measuring" so ChartFrame shows skeleton
  const measuring = width === 0 && !loading;

  const handleBarEnter = useCallback(
    (key: string, di: number, x: number, y: number, label: string, value: number) => {
      const datum = data[di];
      const formatted = fmt(value, datum);
      const keyLabel = seriesLabels?.[key] ?? key;
      const content = tooltipContentFormatter && datum
        ? tooltipContentFormatter(datum, value, keyLabel)
        : buildTooltipContent(keyLabel, label, formatted);
      setTooltip({ visible: true, x, y, content });
    },
    [data, fmt, seriesLabels, tooltipContentFormatter],
  );

  const handleBarLeave = useCallback(
    () => setTooltip((t) => ({ ...t, visible: false })),
    [],
  );

  const handleBarClick = onBarClick
    ? (di: number) => onBarClick(data[di], di)
    : undefined;

  // ── Horizontal layout ─────────────────────────────────────────────────────
  if (layout === "horizontal") {
    // Use container width directly — no minimum forces horizontal scroll.
    const chartWidth = Math.max(width, 200);

    return (
      <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
        <ChartFrame loading={loading || measuring} isEmpty={isEmpty} height={height} scrollY ariaLabel={`Gráfico de barras: ${keys.join(", ")}`}>
          <div style={{ width: chartWidth, position: "relative" }}>
            {keys.map((key, ki) => {
              const color = resolveColor(ki, 0, palette, itemColors);
              const seriesData = data.map((d) => ({
                label: String(d.name),
                value: Number(d[key] ?? 0),
              }));
              const globalMax =
                groupMode === "stacked"
                  ? Math.max(...data.map((d) => keys.reduce((s, k) => s + Number(d[k] ?? 0), 0)), 1)
                  : undefined;
              return (
                <div key={key} style={{ marginBottom: keys.length > 1 ? 12 : 0 }}>
                  {keys.length > 1 && (
                    <SeriesLabel color={itemColors ? palette[0] : color} label={seriesLabels?.[key] ?? key} />
                  )}
                  <SvgBarH
                    width={chartWidth}
                    data={seriesData}
                    color={itemColors ? resolveColor(ki, 0, palette, itemColors) : color}
                    valueFormatter={(v) => fmt(v)}
                    max={globalMax}
                    onBarEnter={(di, x, y, label, value) => handleBarEnter(key, di, x, y, label, value)}
                    onBarLeave={handleBarLeave}
                    onBarClick={handleBarClick}
                  />
                </div>
              );
            })}
            <BarChartTooltip state={tooltip} />
          </div>
        </ChartFrame>
      </div>
    );
  }

  // ── Vertical layout ───────────────────────────────────────────────────────
  const labels = data.map((d) => String(d.name));
  const chartH = height ?? 220;

  if (groupMode === "stacked") {
    return (
      <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
        <ChartFrame loading={loading || measuring} isEmpty={isEmpty} height={height} ariaLabel={`Gráfico de barras empilhadas: ${keys.join(", ")}`}>
          <div style={{ width: "100%", position: "relative" }}>
            {keys.map((key, ki) => {
              const color = resolveColor(ki, 0, palette, itemColors);
              const values = data.map((d) => Number(d[key] ?? 0));
              return (
                <div key={key}>
                  {keys.length > 1 && <SeriesLabel color={color} label={seriesLabels?.[key] ?? key} />}
                  <SvgBarV
                    width={width}
                    height={Math.round(chartH / Math.max(keys.length, 1))}
                    labels={ki === keys.length - 1 ? labels : labels.map(() => "")}
                    values={values}
                    color={color}
                    onBarEnter={(di, x, y, label, value) => handleBarEnter(key, di, x, y, label, value)}
                    onBarLeave={handleBarLeave}
                    onBarClick={handleBarClick}
                  />
                </div>
              );
            })}
          </div>
        </ChartFrame>
      </div>
    );
  }

  // Grouped / single-key vertical
  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <ChartFrame loading={loading || measuring} isEmpty={isEmpty} height={height} ariaLabel={`Gráfico de barras: ${keys.join(", ")}`}>
        <div style={{ width: "100%", position: "relative" }}>
          {keys.length === 1 && seriesLabels && seriesLabels[keys[0]] && (
            <div style={{ marginBottom: 6, textTransform: "uppercase" }}>
              <SeriesLabel color={resolveColor(0, 0, colors ?? palette, itemColors)} label={seriesLabels[keys[0]]} />
            </div>
          )}
          {keys.map((key, ki) => {
            const color = resolveColor(ki, 0, palette, itemColors);
            const values = data.map((d) => Number(d[key] ?? 0));
            // Per-bar colors: when itemColors is defined and we have a single key
            const perBarColors = itemColors && keys.length === 1
              ? data.map((_, di) => resolveColor(ki, di, palette, itemColors))
              : undefined;
            return (
              <div key={key}>
                {keys.length > 1 && <SeriesLabel color={color} label={seriesLabels?.[key] ?? key} />}
                <SvgBarV
                  width={width}
                  height={Math.round(chartH / Math.max(keys.length, 1))}
                  labels={ki === keys.length - 1 ? labels : labels.map(() => "")}
                  values={values}
                  color={color}
                  barColors={perBarColors}
                  onBarEnter={(di, x, y, label, value) => handleBarEnter(key, di, x, y, label, value)}
                  onBarLeave={handleBarLeave}
                  onBarClick={handleBarClick}
                />
              </div>
            );
          })}
          <BarChartTooltip state={tooltip} />
        </div>
      </ChartFrame>
    </div>
  );
}

// ── Convenience wrappers (maintain existing API) ───────────────────────────────
export function VerticalBarChart(props: Omit<BarChartProps, "layout" | "groupMode">) {
  return <BarChart {...props} layout="vertical" />;
}

export function HorizontalBarChart(props: Omit<BarChartProps, "layout" | "groupMode">) {
  return <BarChart {...props} layout="horizontal" />;
}

export function StackedBarChart(props: Omit<BarChartProps, "layout">) {
  return <BarChart {...props} layout="vertical" groupMode="stacked" />;
}
