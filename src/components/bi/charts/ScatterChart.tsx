import { useRef, useState, useCallback } from "react";
import { ChartFrame } from "./ChartFrame";
import { SvgScatter, type ScatterPoint } from "./primitives/SvgScatter";
import { useContainerWidth } from "./primitives/useContainerWidth";
import { getVouxPalette } from "./primitives/svgGeometry";
import { useTheme } from "@/hooks/useTheme";
import { BarChartTooltip, INITIAL_TOOLTIP, type TooltipState } from "./barChartHelpers";

export interface ScatterChartProps {
  data: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  height?: number;
  loading?: boolean;
  color?: string;
  /** HTML do tooltip do ponto. O chamador escapa o que vier de dados. */
  tooltipContent: (point: ScatterPoint) => string;
  ariaLabel?: string;
}

/**
 * Wrapper do scatter — mesma casca dos demais graficos do BI (ChartFrame +
 * medicao de largura + tooltip), para o bloco consumidor nao reimplementar.
 */
export function ScatterChart({
  data,
  xLabel,
  yLabel,
  height = 300,
  loading = false,
  color,
  tooltipContent,
  ariaLabel,
}: ScatterChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(containerRef as React.RefObject<HTMLElement>);
  const { isDark } = useTheme();
  const [tooltip, setTooltip] = useState<TooltipState>(INITIAL_TOOLTIP);

  const handleEnter = useCallback(
    (index: number, x: number, y: number) => {
      const point = data[index];
      if (!point) return;
      setTooltip({ visible: true, x, y, content: tooltipContent(point) });
    },
    [data, tooltipContent],
  );

  const handleLeave = useCallback(() => setTooltip((t) => ({ ...t, visible: false })), []);

  // width=0 significa "ainda medindo" — cai no skeleton, nao no estado vazio
  const measuring = width === 0 && !loading;

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <ChartFrame
        loading={loading || measuring}
        isEmpty={data.length === 0}
        height={height}
        ariaLabel={ariaLabel ?? `Dispersao ${xLabel} por ${yLabel}`}
      >
        <div style={{ width: "100%", position: "relative" }}>
          <SvgScatter
            width={width}
            height={height}
            data={data}
            xLabel={xLabel}
            yLabel={yLabel}
            color={color ?? getVouxPalette(isDark)[0]}
            onPointEnter={handleEnter}
            onPointLeave={handleLeave}
          />
          <BarChartTooltip state={tooltip} />
        </div>
      </ChartFrame>
    </div>
  );
}

export default ScatterChart;
export type { ScatterPoint };
