import { useRef } from "react";
import { ChartFrame } from "./ChartFrame";
import { SvgLine } from "./primitives/SvgLine";
import { useContainerWidth } from "./primitives/useContainerWidth";
import { VOUX_PALETTE } from "./primitives/svgGeometry";

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
          />
        )}
      </div>
    </ChartFrame>
  );
}
