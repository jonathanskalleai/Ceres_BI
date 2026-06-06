import { useRef, useState } from "react";
import { ChartFrame } from "./ChartFrame";
import { SvgLine } from "./primitives/SvgLine";
import { useContainerWidth } from "./primitives/useContainerWidth";
import { VOUX_PALETTE, fmtCompact } from "./primitives/svgGeometry";

export interface LineChartData {
  x: string | number;
  y: number;
}

export interface LineChartSeriesItem {
  name: string;
  data: LineChartData[];
  color?: string;
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
  tooltipFormatter,
}: LineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(containerRef as React.RefObject<HTMLElement>);

  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, content: "" });
  const [hoveredIdx, setHoveredIdx] = useState<number | undefined>(undefined);

  const chartH = height ?? 280;

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
        color: s.color ?? VOUX_PALETTE[i % VOUX_PALETTE.length],
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

  return (
    <ChartFrame loading={loading} isEmpty={isEmpty} height={height}>
      <div ref={containerRef} style={{ width: "100%" }}>
        {width > 0 && (
          <SvgLine
            width={width}
            height={chartH}
            labels={labels}
            series={svgSeries}
            points
            yFmt={tooltipFormatter}
            hoveredIdx={hoveredIdx}
            onHover={(idx, x, y) => {
              setHoveredIdx(idx);
              const label = labels[idx];
              const rows = svgSeries
                .map((s, si) => {
                  const v = s.values[idx];
                  if (v == null) return "";
                  const c = s.color ?? VOUX_PALETTE[si % VOUX_PALETTE.length];
                  const formatted = tooltipFormatter ? tooltipFormatter(v) : fmtCompact(v);
                  return `<div style="display:flex;align-items:center;gap:6px;margin-top:3px"><span style="width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0;display:inline-block"></span><span style="color:#b3ab9c;font-size:11px">${s.name}: <strong style="color:#ece5d4">${formatted}</strong></span></div>`;
                })
                .join("");
              setTooltip({
                visible: true,
                x,
                y,
                content: `<div style="font-size:10px;color:#6b6253;letter-spacing:0.08em;margin-bottom:4px">${label}</div>${rows}`,
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
            background: "rgba(17,16,13,0.96)",
            border: "1px solid rgba(212,184,150,0.15)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            padding: "8px 12px",
            borderRadius: 10,
            fontFamily: "var(--voux-font-mono)",
            fontSize: 11,
            color: "#ece5d4",
            pointerEvents: "none",
            zIndex: 9999,
            whiteSpace: "nowrap",
          }}
          dangerouslySetInnerHTML={{ __html: tooltip.content }}
        />
      )}
    </ChartFrame>
  );
}
