import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import type { EChartsOption } from "echarts";
import echarts from "@/lib/echartsCore";
import {
  CHART_COLORS,
  withAlpha,
  glassTooltip,
  tooltipRow,
  categoryAxisBase,
  valueAxisBase,
  baseAnimation,
  formatCompact,
} from "@/lib/chartTheme";
import { ChartFrame } from "./ChartFrame";

export interface LineChartData {
  x: string | number;
  y: number;
}

export interface LineChartProps {
  data: LineChartData[];
  title?: string;
  height?: number;
  loading?: boolean;
  color?: string;
  strokeWidth?: number;
  area?: boolean;
  tooltipFormatter?: (value: number) => string;
}

function buildOption(
  data: LineChartData[],
  color: string,
  strokeWidth: number,
  area: boolean,
  tooltipFormatter?: (value: number) => string,
): EChartsOption {
  return {
    ...baseAnimation,
    grid: { top: 12, right: 16, bottom: 8, left: 8, containLabel: true },
    tooltip: {
      ...glassTooltip,
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: withAlpha(color, 0.4) } },
      formatter: (params) => {
        const arr = Array.isArray(params) ? params : [params];
        const p = arr[0] as { name: string; value: number; color: string };
        const value = Number(p.value);
        const formatted = tooltipFormatter
          ? tooltipFormatter(value)
          : value.toLocaleString("pt-BR");
        return tooltipRow(String(p.name), "", color, formatted);
      },
    },
    xAxis: {
      ...categoryAxisBase,
      boundaryGap: false,
      data: data.map((d) => String(d.x)),
      axisLabel: {
        ...categoryAxisBase.axisLabel,
        rotation: data.length > 8 ? 30 : 0,
      },
    },
    yAxis: {
      ...valueAxisBase,
      axisLabel: {
        ...valueAxisBase.axisLabel,
        formatter: tooltipFormatter ?? formatCompact,
      },
    },
    series: [
      {
        type: "line",
        smooth: true,
        showSymbol: false,
        data: data.map((d) => d.y),
        lineStyle: {
          color,
          width: strokeWidth,
          shadowBlur: 12,
          shadowColor: withAlpha(color, 0.45),
        },
        itemStyle: { color },
        areaStyle: area
          ? {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: withAlpha(color, 0.35) },
                  { offset: 1, color: withAlpha(color, 0.02) },
                ],
              },
            }
          : undefined,
      },
    ],
  };
}

export default function LineChart({
  data,
  height,
  loading = false,
  color = CHART_COLORS[0],
  strokeWidth = 2.5,
  area = true,
  tooltipFormatter,
}: LineChartProps) {
  const option = useMemo(
    () => buildOption(data, color, strokeWidth, area, tooltipFormatter),
    [data, color, strokeWidth, area, tooltipFormatter],
  );

  return (
    <ChartFrame loading={loading} isEmpty={!data.length} height={height}>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: "100%", width: "100%" }}
        notMerge
        lazyUpdate
        opts={{ renderer: "canvas" }}
      />
    </ChartFrame>
  );
}
