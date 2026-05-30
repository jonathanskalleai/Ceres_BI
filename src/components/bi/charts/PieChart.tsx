import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import type { EChartsOption } from "echarts";
import echarts from "@/lib/echartsCore";
import {
  CHART_COLORS,
  glassTooltip,
  tooltipRow,
  baseAnimation,
} from "@/lib/chartTheme";
import { ChartFrame } from "./ChartFrame";

export interface PieChartData {
  id: string;
  value: number;
  name: string;
}

export interface PieChartProps {
  data: PieChartData[];
  title?: string;
  height?: number;
  loading?: boolean;
  colors?: readonly string[];
  /** Mostra rótulos externos (nome + %); senão usa legenda compacta. */
  enableLabels?: boolean;
  tooltipFormatter?: (value: number) => string;
}

function buildOption(
  data: PieChartData[],
  colors: readonly string[],
  enableLabels: boolean,
  tooltipFormatter?: (value: number) => string,
): EChartsOption {
  return {
    ...baseAnimation,
    color: colors as string[],
    tooltip: {
      ...glassTooltip,
      trigger: "item",
      formatter: (params) => {
        const p = params as {
          name: string;
          value: number;
          color: string;
          percent: number;
        };
        const value = Number(p.value);
        const formatted = tooltipFormatter
          ? tooltipFormatter(value)
          : value.toLocaleString("pt-BR");
        return tooltipRow(
          p.name,
          "",
          String(p.color),
          `${formatted} (${p.percent}%)`,
        );
      },
    },
    legend: enableLabels
      ? { show: false }
      : {
          type: "scroll",
          orient: "horizontal",
          bottom: 0,
          textStyle: { color: "#64748b", fontSize: 11 },
          icon: "circle",
        },
    series: [
      {
        type: "pie",
        radius: enableLabels ? ["45%", "72%"] : ["52%", "78%"],
        center: enableLabels ? ["50%", "50%"] : ["50%", "45%"],
        avoidLabelOverlap: true,
        padAngle: 2,
        itemStyle: {
          borderRadius: 6,
          borderColor: "transparent",
          borderWidth: 2,
        },
        label: enableLabels
          ? {
              show: true,
              formatter: "{b}\n{d}%",
              color: "#64748b",
              fontSize: 11,
              lineHeight: 14,
            }
          : { show: false },
        labelLine: enableLabels
          ? { show: true, length: 10, length2: 10, smooth: true }
          : { show: false },
        data: data.map((d) => ({ name: d.name, value: d.value })),
      },
    ],
  };
}

export default function PieChart({
  data,
  height,
  loading = false,
  colors = CHART_COLORS,
  enableLabels = false,
  tooltipFormatter,
}: PieChartProps) {
  const option = useMemo(
    () => buildOption(data, colors, enableLabels, tooltipFormatter),
    [data, colors, enableLabels, tooltipFormatter],
  );

  return (
    <ChartFrame
      loading={loading}
      isEmpty={!data.length}
      height={height}
      rounded="full"
    >
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

export function PieChartWithLabels(props: Omit<PieChartProps, "enableLabels">) {
  return <PieChart {...props} enableLabels />;
}
