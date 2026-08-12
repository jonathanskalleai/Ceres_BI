import { useRef, useState } from "react";
import { ChartFrame } from "./ChartFrame";
import { SvgDonut } from "./primitives/SvgDonut";
import { useContainerWidth } from "./primitives/useContainerWidth";
import { getVouxPalette, fmtCompact } from "./primitives/svgGeometry";
import { useTheme } from "@/hooks/useTheme";

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  content: string;
}

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
  colors,
  enableLabels: _enableLabels = false,
  tooltipFormatter,
}: PieChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(containerRef as React.RefObject<HTMLElement>);
  const { isDark } = useTheme();
  const palette = colors ?? getVouxPalette(isDark);

  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, content: "" });

  // Rotulos externos funcionam bem em cards largos, mas cortam nomes longos
  // (ex.: Telefonema/Whatsapp) em colunas estreitas. Nelas usamos a legenda
  // HTML quebravel abaixo do donut.
  const useCompactLegend = width > 0 && (width < 640 || data.length > 4);
  const frameHeight = height ?? 280;
  const legendHeight = useCompactLegend ? 54 : 0;
  const labelReserve = useCompactLegend ? 0 : 20;
  const chartH = Math.max(frameHeight - legendHeight - labelReserve, 160);

  const donutData = data.map((d, i) => ({
    label: d.name,
    value: d.value,
    color: palette[i % palette.length] as string,
  }));

  const total = data.reduce((s, d) => s + d.value, 0);
  const centerValue = tooltipFormatter
    ? tooltipFormatter(total)
    : fmtCompact(total);

  // Treat width=0 as "still measuring" so ChartFrame shows skeleton
  const measuring = width === 0 && !loading;

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <ChartFrame loading={loading || measuring} isEmpty={!data.length} height={frameHeight} rounded="full" ariaLabel={`Gráfico de pizza: ${data.map((d) => d.name).join(", ")}`}>
        <div
          style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}
        >
          {width > 0 && (
            <SvgDonut
              width={Math.min(width, chartH)}
              height={chartH}
              data={donutData}
              centerValue={centerValue}
              fmt={tooltipFormatter ?? fmtCompact}
              showLabels={!useCompactLegend}
              onSegmentEnter={(segIdx, x, y) => {
                const d = donutData[segIdx];
                const formatted = tooltipFormatter ? tooltipFormatter(d.value) : fmtCompact(d.value);
                const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
                setTooltip({
                  visible: true,
                  x,
                  y,
                  content: `<div style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:${d.color};display:inline-block"></span><span style="color:var(--voux-tooltip-muted)">${d.label}</span></div><div style="margin-top:4px;color:var(--voux-tooltip-text)"><strong>${formatted}</strong> <span style="color:var(--voux-tooltip-muted)">(${pct}%)</span></div>`,
                });
              }}
              onSegmentLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
            />
          )}
          {useCompactLegend && (
            <div
              className="flex w-full flex-wrap justify-center gap-x-3 gap-y-1 px-1 text-[10px] leading-tight text-[var(--voux-text-muted)]"
              style={{ fontFamily: "var(--voux-font-mono)" }}
            >
              {donutData.map((item) => {
                const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : "0";
                return (
                  <span key={item.label} className="inline-flex max-w-full items-center gap-1">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} />
                    <span className="truncate">{item.label} ({pct}%)</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
        {tooltip.visible && (
          <div
            style={{
              position: "fixed",
              left: tooltip.x + 14,
              top: tooltip.y - 10,
              background: "var(--voux-tooltip-bg)",
              border: "1px solid var(--voux-tooltip-border)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              padding: "8px 12px",
              borderRadius: 10,
              fontFamily: "var(--voux-font-mono)",
              fontSize: 11,
              color: "var(--voux-tooltip-text)",
              pointerEvents: "none",
              zIndex: 9999,
              whiteSpace: "nowrap",
            }}
            dangerouslySetInnerHTML={{ __html: tooltip.content }}
          />
        )}
      </ChartFrame>
    </div>
  );
}

export function PieChartWithLabels(props: Omit<PieChartProps, "enableLabels">) {
  return <PieChart {...props} enableLabels />;
}
