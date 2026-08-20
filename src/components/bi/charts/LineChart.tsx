import { useRef, useState } from "react";
import { ChartFrame } from "./ChartFrame";
import { SvgLine } from "./primitives/SvgLine";
import { useContainerWidth } from "./primitives/useContainerWidth";
import { VOUX_PALETTE, getVouxPalette, fmtCompact } from "./primitives/svgGeometry";
import { useTheme } from "@/hooks/useTheme";

export interface LineChartData {
  x: string | number;
  y: number | null;
}

export interface LineChartSeriesItem {
  name: string;
  data: LineChartData[];
  color?: string;
  dashed?: boolean;
}

export interface LineChartProps {
  data?: LineChartData[];
  /** Multi-série: quando definido, sobrescreve `data` */
  series?: LineChartSeriesItem[];
  title?: string;
  seriesName?: string;
  height?: number;
  loading?: boolean;
  color?: string;
  strokeWidth?: number;
  area?: boolean;
  /** Mostrar rótulos numéricos nos pontos. Em séries longas, o tooltip basta. */
  showValues?: boolean;
  /** Each series gets its own Y scale (spreads lines apart). Hides Y axis. */
  independentAxes?: boolean;
  tooltipFormatter?: (value: number) => string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  content: string;
}

export default function LineChart({
  data = [],
  series,
  height,
  loading = false,
  color = VOUX_PALETTE[0],
  seriesName,
  independentAxes,
  area = true,
  showValues = true,
  tooltipFormatter,
}: LineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(containerRef as React.RefObject<HTMLElement>);
  const { isDark } = useTheme();
  const palette = getVouxPalette(isDark);

  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, content: "" });
  const [hoveredIdx, setHoveredIdx] = useState<number | undefined>(undefined);

  // Account for legend height so SVG + legend fit within ChartFrame's fixed height
  const showLegendEarly = series && series.length > 0 && series[0].name !== "Valor";
  const legendH = showLegendEarly ? 36 : 0;
  const chartH = (height ?? 280) - legendH;

  // Normalise to SvgLine series format
  let svgSeries: import("./primitives/SvgLine").SvgLineSeries[];
  let labels: string[];

  if (series && series.length > 0) {
    // Multi-series: collect all unique x labels in order
    const xSet = new Set<string>();
    for (const s of series) for (const d of s.data) xSet.add(String(d.x));
    labels = Array.from(xSet);

    svgSeries = series.map((s, i) => {
      const dataMap = new Map(s.data.map((d) => [String(d.x), d.y]));
      return {
        name: s.name,
        color: s.color ?? palette[i % palette.length],
        dashed: s.dashed,
        values: labels.map((lbl) => dataMap.get(lbl) ?? null),
      };
    });
  } else {
    // Single series from `data` prop
    labels = data.map((d) => String(d.x));
    svgSeries = [
      {
        name: seriesName ?? "Valor",
        color,
        values: data.map((d) => d.y),
      },
    ];
  }

  const isEmpty = series
    ? series.every((s) => s.data.length === 0)
    : data.length === 0;

  // Treat width=0 as "still measuring" so ChartFrame shows skeleton
  const measuring = width === 0 && !loading;

  // Always show legend to give context (single or multi-series)
  const showLegend = svgSeries.length >= 1 && svgSeries[0].name !== "Valor";

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <ChartFrame loading={loading || measuring} isEmpty={isEmpty} height={height}>
        {showLegend && (
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 8,
              paddingLeft: 4,
              flexWrap: "wrap",
            }}
          >
            {svgSeries.map((s) => (
              <div
                key={s.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "var(--voux-font-mono, monospace)",
                  fontSize: 12,
                  color: "var(--voux-text-muted)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: s.color ?? "var(--voux-champagne-400)",
                    flexShrink: 0,
                    display: "inline-block",
                  }}
                />
                {s.name}
              </div>
            ))}
          </div>
        )}
        <div style={{ width: "100%" }}>
          {width > 0 && (
            <SvgLine
              width={width}
              height={chartH}
              labels={labels}
              series={svgSeries}
              points
              area={area}
              showValues={showValues}
              independentAxes={independentAxes}
              yFmt={tooltipFormatter}
              hoveredIdx={hoveredIdx}
              onHover={(idx, x, y) => {
                setHoveredIdx(idx);
                const label = labels[idx];
                const rows = svgSeries
                  .map((s, si) => {
                    const v = s.values[idx];
                    if (v == null) return "";
                    const c = s.color ?? palette[si % palette.length];
                    const formatted = tooltipFormatter ? tooltipFormatter(v) : fmtCompact(v);
                    return `<div style="display:flex;align-items:center;gap:6px;margin-top:3px"><span style="width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0;display:inline-block"></span><span style="color:var(--voux-tooltip-muted);font-size:11px">${s.name}: <strong style="color:var(--voux-tooltip-text)">${formatted}</strong></span></div>`;
                  })
                  .join("");
                setTooltip({
                  visible: true,
                  x,
                  y,
                  content: `<div style="font-size:10px;color:var(--voux-tooltip-muted);letter-spacing:0.08em;margin-bottom:4px">${label}</div>${rows}`,
                });
              }}
              onLeave={() => {
                setTooltip((t) => ({ ...t, visible: false }));
                setHoveredIdx(undefined);
              }}
            />
          )}
        </div>
        {tooltip.visible && (
          <div
            style={{
              position: "fixed",
              left: tooltip.x + 14,
              top: tooltip.y - 10,
              background: "var(--voux-tooltip-bg)",
              border: "1px solid var(--voux-tooltip-border)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              padding: "8px 12px",
              borderRadius: 10,
              fontFamily: "var(--voux-font-mono)",
              fontSize: 11,
              color: "var(--voux-tooltip-text)",
              pointerEvents: "none",
              zIndex: 9999,
              whiteSpace: "nowrap",
            }}
            dangerouslySetInnerHTML={{ __html: tooltip.content }}
          />
        )}
      </ChartFrame>
    </div>
  );
}
