import { useRef } from "react";
import { ChartFrame } from "./ChartFrame";
import { SvgDonut } from "./primitives/SvgDonut";
import { useContainerWidth } from "./primitives/useContainerWidth";
import { VOUX_PALETTE, fmtCompact } from "./primitives/svgGeometry";

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

export default function PieChart({
  data,
  height,
  loading = false,
  colors = VOUX_PALETTE,
  enableLabels: _enableLabels = false,
  tooltipFormatter,
}: PieChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(containerRef as React.RefObject<HTMLElement>);

  const chartH = height ?? 200;

  const donutData = data.map((d, i) => ({
    label: d.name,
    value: d.value,
    color: colors[i % colors.length] as string,
  }));

  const total = data.reduce((s, d) => s + d.value, 0);
  const centerValue = tooltipFormatter
    ? tooltipFormatter(total)
    : fmtCompact(total);

  return (
    <ChartFrame loading={loading} isEmpty={!data.length} height={height} rounded="full">
      <div
        ref={containerRef}
        style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}
      >
        {width > 0 && (
          <SvgDonut
            width={Math.min(width, chartH)}
            height={chartH}
            data={donutData}
            centerValue={centerValue}
            fmt={tooltipFormatter ?? fmtCompact}
          />
        )}
      </div>
    </ChartFrame>
  );
}

export function PieChartWithLabels(props: Omit<PieChartProps, "enableLabels">) {
  return <PieChart {...props} enableLabels />;
}
