import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import type { EChartsOption } from "echarts";
import echarts from "@/lib/echartsCore";
import {
  CHART_COLORS,
  tooltipRow,
  baseAnimation,
  formatCompact,
} from "@/lib/chartTheme";
import { useChartTheme } from "@/hooks/useChartTheme";
import { ChartFrame } from "./ChartFrame";

export interface ComboChartData {
  name: string;
  [key: string]: string | number;
}

export interface ComboChartProps {
  data: ComboChartData[];
  barKeys: string[];
  lineKey: string;
  /** Labels amigáveis por key */
  seriesLabels?: Record<string, string>;
  barColors?: readonly string[];
  lineColor?: string;
  title?: string;
  height?: number;
  loading?: boolean;
  tooltipFormatter?: (value: number, key: string) => string;
}

function buildOption(
  data: ComboChartData[],
  barKeys: string[],
  lineKey: string,
  barColors: readonly string[],
  lineColor: string,
  tooltip: EChartsOption["tooltip"],
  categoryAxis: ReturnType<typeof import("@/lib/chartTheme").buildCategoryAxis>,
  valueAxis: ReturnType<typeof import("@/lib/chartTheme").buildValueAxis>,
  labelColor: string,
  legendColor: string,
  seriesLabels?: Record<string, string>,
  tooltipFormatter?: (value: number, key: string) => string,
): EChartsOption {
  const categories = data.map((d) => String(d.name));

  const barSeries = barKeys.map((key, i) => ({
    name: seriesLabels?.[key] ?? key,
    type: "bar" as const,
    yAxisIndex: 0,
    data: data.map((d) => Number(d[key] ?? 0)),
    barMaxWidth: 28,
    itemStyle: {
      color: barColors[i % barColors.length],
      borderRadius: [3, 3, 0, 0],
    },
    label: {
      show: false,
    },
  }));

  const lineSeries = {
    name: seriesLabels?.[lineKey] ?? lineKey,
    type: "line" as const,
    yAxisIndex: 1,
    data: data.map((d) => Number(d[lineKey] ?? 0)),
    smooth: true,
    showSymbol: true,
    symbolSize: data.length > 12 ? 3 : data.length > 6 ? 4 : 6,
    lineStyle: { color: lineColor, width: 2.5 },
    itemStyle: { color: lineColor },
    label: { show: false },
  };

  return {
    ...baseAnimation,
    grid: { top: 40, right: 60, bottom: 12, left: 12, containLabel: true },
    legend: {
      show: true,
      top: 4,
      right: 12,
      textStyle: { color: legendColor, fontSize: 12 },
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 16,
    },
    tooltip: {
      ...tooltip,
      trigger: "axis",
      formatter: (params) => {
        const arr = Array.isArray(params) ? params : [params];
        const axisName = String((arr[0] as { name: string }).name);
        const rows = arr
          .map((p) => {
            const pp = p as { value: number; color: string; seriesName: string; seriesId?: string };
            const val = Number(pp.value);
            const key = pp.seriesName;
            const formatted = tooltipFormatter
              ? tooltipFormatter(val, key)
              : val.toLocaleString("pt-BR");
            return tooltipRow("", key, String(pp.color), formatted);
          })
          .join("");
        return `<div><div style="font-size:12px;color:#dbc9a9;margin-bottom:4px">${axisName}</div>${rows}</div>`;
      },
    },
    xAxis: {
      ...categoryAxis,
      data: categories,
      axisLabel: {
        ...categoryAxis.axisLabel,
        rotation: categories.length > 6 ? 30 : 0,
      },
    },
    yAxis: [
      {
        ...valueAxis,
        axisLabel: { ...valueAxis.axisLabel, formatter: formatCompact },
      },
      {
        ...valueAxis,
        axisLabel: { ...valueAxis.axisLabel, formatter: formatCompact },
        splitLine: { show: false },
      },
    ],
    series: [...barSeries, lineSeries],
  };
}

export default function ComboChart({
  data,
  barKeys,
  lineKey,
  seriesLabels,
  barColors = CHART_COLORS,
  lineColor = CHART_COLORS[2],
  height,
  loading = false,
  tooltipFormatter,
}: ComboChartProps) {
  const { tooltip, categoryAxis, valueAxis, vars } = useChartTheme();

  const option = useMemo(
    () =>
      buildOption(
        data,
        barKeys,
        lineKey,
        barColors,
        lineColor,
        tooltip,
        categoryAxis,
        valueAxis,
        vars.axisText,
        vars.legendText,
        seriesLabels,
        tooltipFormatter,
      ),
    [data, barKeys, lineKey, barColors, lineColor, tooltip, categoryAxis, valueAxis, vars.axisText, vars.legendText, seriesLabels, tooltipFormatter],
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
