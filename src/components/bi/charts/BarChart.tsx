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
  /** Labels amigáveis para cada key (ex: { value: "Clientes" }) — sobrescreve defaults */
  seriesLabels?: Record<string, string>;
  height?: number;
  loading?: boolean;
  tooltipFormatter?: (value: number, datum?: BarChartData) => string;
  groupMode?: "grouped" | "stacked";
  onBarClick?: (datum: BarChartData, index: number) => void;
}

const SERIES_LABELS: Record<string, string> = {
  ganhos: "Ganhos",
  perdidos: "Perdidos",
  andamento: "Em andamento",
  valor: "Valor",
  valorGanho: "Valor Ganho",
  value: "Quantidade",
  novos: "Novos",
  diasMedio: "Dias (média)",
  faturamento: "Faturamento",
  atendimento: "Atendimento",
  deslocamento: "Deslocamento",
  ocioso: "Ocioso",
  acoes: "Ações",
};

const LABEL_THRESHOLD_H = 20;
const LABEL_THRESHOLD_V = 12;

function buildOption(
  data: BarChartData[],
  keys: string[],
  layout: "horizontal" | "vertical",
  groupMode: "grouped" | "stacked",
  colors: readonly string[],
  tooltip: EChartsOption["tooltip"],
  categoryAxis: ReturnType<typeof import("@/lib/chartTheme").buildCategoryAxis>,
  valueAxis: ReturnType<typeof import("@/lib/chartTheme").buildValueAxis>,
  labelColor: string,
  legendColor: string,
  seriesLabels?: Record<string, string>,
  tooltipFormatter?: (value: number, datum?: BarChartData) => string,
  itemColors?: string[],
): EChartsOption {
  const isHorizontal = layout === "horizontal";
  const categories = data.map((d) => String(d.name));
  const showLabels = isHorizontal
    ? data.length <= LABEL_THRESHOLD_H
    : data.length <= LABEL_THRESHOLD_V;

  const series = keys.map((key, i) => {
    const seriesColor = colors[i % colors.length];
    // When itemColors is provided, each bar gets its own color by dataIndex
    const itemStyleData = itemColors
      ? data.map((d, idx) => ({
          value: Number(d[key] ?? 0),
          itemStyle: {
            color: itemColors[idx % itemColors.length],
            borderRadius: isHorizontal ? [0, 3, 3, 0] : [3, 3, 0, 0],
          },
        }))
      : data.map((d) => Number(d[key] ?? 0));

    return {
      name: seriesLabels?.[key] ?? SERIES_LABELS[key] ?? key,
      type: "bar" as const,
      stack: groupMode === "stacked" ? "total" : undefined,
      data: itemStyleData,
      barMaxWidth: 24,
      itemStyle: itemColors
        ? undefined
        : {
            color: seriesColor,
            borderRadius: isHorizontal ? [0, 3, 3, 0] : [3, 3, 0, 0],
          },
      label: {
        show: showLabels,
        position: isHorizontal ? "right" as const : "top" as const,
        fontSize: 12,
        color: labelColor,
        formatter: (params: { value: number }) => formatCompact(params.value),
        overflow: "truncate" as const,
        ellipsis: "...",
      },
    };
  });

  const catAxis = {
    ...categoryAxis,
    data: categories,
    inverse: isHorizontal,
    axisLabel: {
      ...categoryAxis.axisLabel,
      rotation: !isHorizontal && categories.length > 6 ? 30 : 0,
    },
  };
  const valAxis = {
    ...valueAxis,
    axisLabel: { ...valueAxis.axisLabel, formatter: formatCompact },
  };

  return {
    ...baseAnimation,
    grid: { top: 40, right: 20, bottom: 12, left: 12, containLabel: true },
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
    barCategoryGap: "35%",
    barGap: "30%",
    labelLayout: { hideOverlap: true },
    tooltip: {
      ...tooltip,
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
    xAxis: isHorizontal ? valAxis : catAxis,
    yAxis: isHorizontal ? catAxis : valAxis,
    series,
  };
}

export default function BarChart({
  data,
  layout = "vertical",
  keys,
  colors = CHART_COLORS,
  itemColors,
  seriesLabels,
  height,
  loading = false,
  tooltipFormatter,
  groupMode = "grouped",
  onBarClick,
}: BarChartProps) {
  const { tooltip, categoryAxis, valueAxis, vars } = useChartTheme();

  const option = useMemo(
    () => buildOption(data, keys, layout, groupMode, colors, tooltip, categoryAxis, valueAxis, vars.axisText, vars.legendText, seriesLabels, tooltipFormatter, itemColors),
    [data, keys, layout, groupMode, colors, tooltip, categoryAxis, valueAxis, vars.axisText, vars.legendText, seriesLabels, tooltipFormatter, itemColors],
  );

  const onEvents = useMemo(() => {
    if (!onBarClick) return undefined;
    return {
      click: (params: { dataIndex: number }) => {
        const datum = data[params.dataIndex];
        if (datum) onBarClick(datum, params.dataIndex);
      },
    };
  }, [onBarClick, data]);

  return (
    <ChartFrame loading={loading} isEmpty={!data.length} height={height}>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: "100%", width: "100%" }}
        notMerge
        lazyUpdate
        opts={{ renderer: "canvas" }}
        onEvents={onEvents}
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
