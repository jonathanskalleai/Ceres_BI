import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import type { EChartsOption } from "echarts";
import echarts from "@/lib/echartsCore";
import {
  CHART_COLORS,
  withAlpha,
  tooltipRow,
  baseAnimation,
  formatCompact,
} from "@/lib/chartTheme";
import { useChartTheme } from "@/hooks/useChartTheme";
import { ChartFrame } from "./ChartFrame";

export interface LineChartData {
  x: string | number;
  y: number;
}

export interface LineChartSeriesItem {
  name: string;
  data: LineChartData[];
  color?: string;
}

const LABEL_THRESHOLD_LINE = 20;

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

function buildSingleOption(
  data: LineChartData[],
  color: string,
  strokeWidth: number,
  area: boolean,
  tooltip: EChartsOption["tooltip"],
  categoryAxis: ReturnType<typeof import("@/lib/chartTheme").buildCategoryAxis>,
  valueAxis: ReturnType<typeof import("@/lib/chartTheme").buildValueAxis>,
  labelColor: string,
  legendColor: string,
  seriesName?: string,
  tooltipFormatter?: (value: number) => string,
): EChartsOption {
  return {
    ...baseAnimation,
    grid: { top: 40, right: 24, bottom: 8, left: 8, containLabel: true },
    legend: {
      show: true,
      top: 4,
      right: 12,
      textStyle: { color: legendColor, fontSize: 12 },
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
    },
    labelLayout: { hideOverlap: true },
    tooltip: {
      ...tooltip,
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
      ...categoryAxis,
      boundaryGap: false,
      data: data.map((d) => String(d.x)),
      axisLabel: {
        ...categoryAxis.axisLabel,
        rotation: data.length > 8 ? 30 : 0,
      },
    },
    yAxis: {
      ...valueAxis,
      axisLabel: {
        ...valueAxis.axisLabel,
        formatter: tooltipFormatter ?? formatCompact,
      },
    },
    series: [
      {
        name: seriesName ?? "Valor",
        type: "line",
        smooth: true,
        showSymbol: true,
        symbolSize: data.length > 12 ? 3 : data.length > 6 ? 4 : 6,
        data: data.map((d) => d.y),
        lineStyle: {
          color,
          width: strokeWidth,
        },
        itemStyle: { color },
        label: {
          show: data.length <= LABEL_THRESHOLD_LINE,
          position: "top" as const,
          fontSize: 12,
          color: labelColor,
          formatter: (params: { value: number }) => formatCompact(params.value),
        },
        areaStyle: undefined,
      },
    ],
  };
}

function buildMultiSeriesOption(
  seriesItems: LineChartSeriesItem[],
  strokeWidth: number,
  tooltip: EChartsOption["tooltip"],
  categoryAxis: ReturnType<typeof import("@/lib/chartTheme").buildCategoryAxis>,
  valueAxis: ReturnType<typeof import("@/lib/chartTheme").buildValueAxis>,
  labelColor: string,
  legendColor: string,
  tooltipFormatter?: (value: number) => string,
): EChartsOption {
  // Collect all unique x values for the category axis
  const xSet = new Set<string>();
  for (const s of seriesItems) for (const d of s.data) xSet.add(String(d.x));
  const categories = Array.from(xSet).sort();

  return {
    ...baseAnimation,
    grid: { top: 40, right: 24, bottom: 8, left: 8, containLabel: true },
    legend: {
      show: true,
      top: 4,
      right: 12,
      textStyle: { color: legendColor, fontSize: 12 },
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
    },
    labelLayout: { hideOverlap: true },
    tooltip: {
      ...tooltip,
      trigger: "axis",
      formatter: (params) => {
        const arr = Array.isArray(params) ? params : [params];
        const name = (arr[0] as { name: string }).name;
        const rows = arr
          .map((p) => {
            const pp = p as { value: number; color: string; seriesName: string };
            const val = Number(pp.value);
            const formatted = tooltipFormatter
              ? tooltipFormatter(val)
              : val.toLocaleString("pt-BR");
            return tooltipRow("", String(pp.seriesName), String(pp.color), formatted);
          })
          .join("");
        return `<div><div style="font-size:12px;color:#dbc9a9;margin-bottom:4px">${name}</div>${rows}</div>`;
      },
    },
    xAxis: {
      ...categoryAxis,
      boundaryGap: false,
      data: categories,
      axisLabel: {
        ...categoryAxis.axisLabel,
        rotation: categories.length > 8 ? 30 : 0,
      },
    },
    yAxis: {
      ...valueAxis,
      axisLabel: {
        ...valueAxis.axisLabel,
        formatter: tooltipFormatter ?? formatCompact,
      },
    },
    series: seriesItems.map((s, i) => {
      const color = s.color ?? CHART_COLORS[i % CHART_COLORS.length];
      // Map data to category positions
      const dataMap = new Map(s.data.map((d) => [String(d.x), d.y]));
      return {
        name: s.name,
        type: "line" as const,
        smooth: true,
        showSymbol: true,
        symbolSize: categories.length > 12 ? 3 : categories.length > 6 ? 4 : 6,
        data: categories.map((x) => dataMap.get(x) ?? null),
        lineStyle: { color, width: strokeWidth },
        itemStyle: { color },
        label: {
          show: categories.length <= LABEL_THRESHOLD_LINE,
          position: "top" as const,
          fontSize: 12,
          color: labelColor,
          formatter: (params: { value: number }) => formatCompact(params.value),
        },
        areaStyle: undefined,
      };
    }),
  };
}

export default function LineChart({
  data = [],
  series,
  height,
  loading = false,
  color = CHART_COLORS[0],
  strokeWidth = 2.5,
  area = true,
  seriesName,
  tooltipFormatter,
}: LineChartProps) {
  const { tooltip, categoryAxis, valueAxis, vars } = useChartTheme();

  const option = useMemo(() => {
    if (series && series.length > 0) {
      return buildMultiSeriesOption(series, strokeWidth, tooltip, categoryAxis, valueAxis, vars.axisText, vars.legendText, tooltipFormatter);
    }
    return buildSingleOption(data, color, strokeWidth, area, tooltip, categoryAxis, valueAxis, vars.axisText, vars.legendText, seriesName, tooltipFormatter);
  }, [data, series, color, strokeWidth, area, tooltip, categoryAxis, valueAxis, vars.axisText, vars.legendText, seriesName, tooltipFormatter]);

  const isEmpty = series
    ? series.every((s) => s.data.length === 0)
    : data.length === 0;

  return (
    <ChartFrame loading={loading} isEmpty={isEmpty} height={height}>
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
