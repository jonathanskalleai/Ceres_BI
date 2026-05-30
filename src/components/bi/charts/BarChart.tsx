import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import type { EChartsOption } from "echarts";
import echarts from "@/lib/echartsCore";
import {
  CHART_COLORS,
  gradientFill,
  glassTooltip,
  tooltipRow,
  categoryAxisBase,
  valueAxisBase,
  baseAnimation,
  formatCompact,
} from "@/lib/chartTheme";
import { ChartFrame } from "./ChartFrame";

export interface BarChartData {
  name: string;
  [key: string]: string | number;
}

export interface BarChartProps {
  data: BarChartData[];
  layout?: "horizontal" | "vertical";
  keys: string[];
  colors?: readonly string[];
  title?: string;
  height?: number;
  loading?: boolean;
  tooltipFormatter?: (value: number, datum?: BarChartData) => string;
  groupMode?: "grouped" | "stacked";
}

const SERIES_LABELS: Record<string, string> = {
  ganhos: "Ganhos",
  perdidos: "Perdidos",
  andamento: "Em andamento",
};

function buildOption(
  data: BarChartData[],
  keys: string[],
  layout: "horizontal" | "vertical",
  groupMode: "grouped" | "stacked",
  colors: readonly string[],
  tooltipFormatter?: (value: number, datum?: BarChartData) => string,
): EChartsOption {
  const isHorizontal = layout === "horizontal";
  const categories = data.map((d) => String(d.name));
  const gradientDir = isHorizontal ? "horizontal" : "vertical";

  const series = keys.map((key, i) => {
    const color = colors[i % colors.length];
    return {
      name: SERIES_LABELS[key] ?? key,
      type: "bar" as const,
      stack: groupMode === "stacked" ? "total" : undefined,
      data: data.map((d) => Number(d[key] ?? 0)),
      barMaxWidth: 26,
      itemStyle: {
        color: gradientFill(color, gradientDir),
        borderRadius: isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
      },
    };
  });

  const categoryAxis = {
    ...categoryAxisBase,
    data: categories,
    // horizontal: primeiro item no topo (leitura de ranking top-down)
    inverse: isHorizontal,
    axisLabel: {
      ...categoryAxisBase.axisLabel,
      rotation: !isHorizontal && categories.length > 6 ? 30 : 0,
    },
  };
  const valueAxis = {
    ...valueAxisBase,
    axisLabel: { ...valueAxisBase.axisLabel, formatter: formatCompact },
  };

  return {
    ...baseAnimation,
    grid: { top: 12, right: 16, bottom: 8, left: 8, containLabel: true },
    tooltip: {
      ...glassTooltip,
      trigger: "item",
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        const idx = (p as { dataIndex: number }).dataIndex;
        const datum = data[idx];
        const value = Number((p as { value: number }).value);
        const formatted = tooltipFormatter
          ? tooltipFormatter(value, datum)
          : value.toLocaleString("pt-BR");
        return tooltipRow(
          String((p as { name: string }).name),
          String((p as { seriesName?: string }).seriesName ?? ""),
          String((p as { color: string }).color),
          formatted,
        );
      },
    },
    xAxis: isHorizontal ? valueAxis : categoryAxis,
    yAxis: isHorizontal ? categoryAxis : valueAxis,
    series,
  };
}

export default function BarChart({
  data,
  layout = "vertical",
  keys,
  colors = CHART_COLORS,
  height,
  loading = false,
  tooltipFormatter,
  groupMode = "grouped",
}: BarChartProps) {
  const option = useMemo(
    () => buildOption(data, keys, layout, groupMode, colors, tooltipFormatter),
    [data, keys, layout, groupMode, colors, tooltipFormatter],
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

export function VerticalBarChart(
  props: Omit<BarChartProps, "layout" | "groupMode">,
) {
  return <BarChart {...props} layout="vertical" />;
}

export function HorizontalBarChart(
  props: Omit<BarChartProps, "layout" | "groupMode">,
) {
  return <BarChart {...props} layout="horizontal" />;
}

export function StackedBarChart(props: Omit<BarChartProps, "layout">) {
  return <BarChart {...props} layout="vertical" groupMode="stacked" />;
}
