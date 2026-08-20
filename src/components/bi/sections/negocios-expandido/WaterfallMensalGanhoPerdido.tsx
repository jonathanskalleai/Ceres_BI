import { useMemo, useRef } from "react";
import { ChartCard } from "@/components/bi/ChartCard";
import { fmtBRLKpi } from "@/lib/formatters";
import { formatMonthYear } from "@/lib/dateUtils";
import { useContainerWidth } from "@/components/bi/charts/primitives/useContainerWidth";
import type { WaterfallMensalGanhoPerdidoItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: WaterfallMensalGanhoPerdidoItem[];
  loading?: boolean;
}

const GAIN_COLOR = "#4caf7a";
const LOSS_COLOR = "#c97565";
const NET_COLOR = "#8ea3b8";

function WaterfallChart({ data }: { data: WaterfallMensalGanhoPerdidoItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef as React.RefObject<HTMLElement>);

  const { bars, maxAbs } = useMemo(() => {
    const bars: { label: string; value: number; start: number; end: number; type: "ganho" | "perda" | "liquido" }[] = [];
    let acc = 0;

    for (const item of data) {
      const start = acc;
      const gain = item.ganho;
      const loss = item.perda;
      const net = item.liquido;
      const label = formatMonthYear(item.name);

      if (gain > 0) {
        bars.push({ label, value: gain, start, end: start + gain, type: "ganho" });
      }
      if (loss > 0) {
        bars.push({ label, value: -loss, start: start + gain, end: start + gain - loss, type: "perda" });
      }
      acc += net;
    }

    if (data.length > 0) {
      bars.push({ label: "Líquido", value: acc, start: 0, end: acc, type: "liquido" });
    }

    const allValues = bars.flatMap((b) => [b.start, b.end]);
    return { bars, maxAbs: Math.max(...allValues.map(Math.abs), 1) };
  }, [data]);

  const svgH = 200;
  const padX = 52;
  const padY = 10;
  const plotH = svgH - padY - 20;
  const svgW = Math.max(containerWidth - padX - 8, 300);
  const getY = (v: number) => padY + plotH / 2 - (v / maxAbs) * (plotH / 2 - 8);

  return (
    <div ref={containerRef} style={{ width: "100%", minWidth: 0 }}>
      {containerWidth > 0 && (
        <svg
          width="100%"
          height={svgH}
          viewBox={`0 0 ${svgW + padX} ${svgH}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block", fontFamily: "var(--voux-font-mono, monospace)" }}
        >
          <line x1={padX} y1={getY(0)} x2={svgW + padX} y2={getY(0)} stroke="var(--voux-gridline,#e1e0d9)" strokeWidth={1} />
          <text x={padX - 4} y={getY(0) + 4} textAnchor="end" fontSize={9} fill="var(--voux-text-muted)">0</text>

          {bars.map((bar, i) => {
            const barW = Math.max((svgW / bars.length) - 12, 8);
            const barX = padX + (svgW / bars.length) * i + (svgW / bars.length - barW) / 2;
            const yTop = getY(Math.max(bar.start, bar.end));
            const barH = Math.max(Math.abs(bar.end - bar.start), 4);
            const actualY = bar.end >= bar.start ? yTop : getY(bar.start);
            const color = bar.type === "ganho" ? GAIN_COLOR : bar.type === "perda" ? LOSS_COLOR : NET_COLOR;

            return (
              <g key={i}>
                <rect x={barX} y={actualY} width={barW} height={barH} fill={color} opacity={0.85} rx={3} />
                <text x={barX + barW / 2} y={svgH - 2} textAnchor="middle" fontSize={9} fill="var(--voux-text-muted)">{bar.label}</text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export function WaterfallMensalGanhoPerdido({ data, loading }: Props) {
  const summary = useMemo(() => {
    return {
      totalGanho: data.reduce((s, d) => s + d.ganho, 0),
      totalPerda: data.reduce((s, d) => s + d.perda, 0),
      totalLiquido: data.reduce((s, d) => s + d.liquido, 0),
    };
  }, [data]);

  return (
    <ChartCard
      title="Evolução Mensal: Ganho vs. Perda"
      description="Barras: verde = ganho, vermelho = perda, cinza = líquido total. Rolling 12 meses."
      loading={loading}
      height={300}
      footer={
        <div className="flex gap-6 text-[11px] font-mono">
          <span><span style={{ color: GAIN_COLOR }}>●</span> Ganho: <strong style={{ color: "var(--voux-text-primary)" }}>{fmtBRLKpi(summary.totalGanho)}</strong></span>
          <span><span style={{ color: LOSS_COLOR }}>●</span> Perda: <strong style={{ color: "var(--voux-text-primary)" }}>{fmtBRLKpi(summary.totalPerda)}</strong></span>
          <span><span style={{ color: NET_COLOR }}>●</span> Líquido: <strong style={{ color: summary.totalLiquido >= 0 ? GAIN_COLOR : LOSS_COLOR }}>{fmtBRLKpi(summary.totalLiquido)}</strong></span>
        </div>
      }
    >
      <WaterfallChart data={data} />
    </ChartCard>
  );
}
