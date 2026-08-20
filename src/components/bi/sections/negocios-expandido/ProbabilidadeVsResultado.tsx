import { useMemo, useRef } from "react";
import { ChartCard } from "@/components/bi/ChartCard";
import { fmtPct } from "@/lib/formatters";
import { fmtBRLKpi } from "@/lib/formatters";
import { fmtNum } from "@/lib/formatters";
import { useContainerWidth } from "@/components/bi/charts/primitives/useContainerWidth";
import type { ProbabilidadeVsResultadoItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: ProbabilidadeVsResultadoItem[];
  loading?: boolean;
}

function ScatterChart({ data }: { data: ProbabilidadeVsResultadoItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef as React.RefObject<HTMLElement>);

  const { dots, maxValue } = useMemo(() => {
    const max = Math.max(...data.map((d) => d.valor_total), 1);
    const dots = data.map((item) => {
      // X = estrelas (1-5), Y = taxa_conversao_real (0-100)
      const cx = (item.estrelas - 1) / 4; // normalize to 0-1
      const cy = 1 - item.taxa_conversao_real / 100; // invert Y (0% at top, 100% at bottom)
      const r = Math.sqrt(item.valor_total / max) * 20 + 6; // bubble radius proportional to value
      return { item, cx, cy, r };
    });
    return { dots, maxValue: max };
  }, [data]);

  const svgW = Math.max(containerWidth - 16, 280);
  const svgH = 200;
  const padX = 48;
  const padY = 24;
  const plotW = svgW - padX;
  const plotH = svgH - padY;

  // Reference line: y = x (where taxa_real = estrelas * 20)
  const refLine = [
    { x: padX, y: padY + plotH * (1 - 20 / 100) },
    { x: padX + plotW, y: padY + plotH * (1 - 100 / 100) },
  ];

  return (
    <div ref={containerRef} style={{ width: "100%", minWidth: 0 }}>
      {containerWidth > 0 && (
        <svg
          width="100%"
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block", fontFamily: "var(--voux-font-mono, monospace)" }}
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const y = padY + plotH * (1 - pct / 100);
            return (
              <g key={pct}>
                <line
                  x1={padX}
                  y1={y}
                  x2={padX + plotW}
                  y2={y}
                  stroke="var(--voux-gridline, #e1e0d9)"
                  strokeWidth={1}
                  strokeDasharray={pct === 0 || pct === 100 ? "none" : "3,3"}
                />
                <text x={padX - 4} y={y + 4} textAnchor="end" fontSize={9} fill="var(--voux-text-muted)">
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
          {[1, 2, 3, 4, 5].map((star) => {
            const x = padX + ((star - 1) / 4) * plotW;
            return (
              <text key={star} x={x} y={svgH - 4} textAnchor="middle" fontSize={9} fill="var(--voux-text-muted)">
                {star}★ CRM
              </text>
            );
          })}

          {/* Reference diagonal line */}
          <line
            x1={refLine[0].x}
            y1={refLine[0].y}
            x2={refLine[1].x}
            y2={refLine[1].y}
            stroke="var(--voux-text-muted)"
            strokeWidth={1.5}
            strokeDasharray="4,3"
          />
          <text
            x={refLine[1].x - 8}
            y={refLine[1].y - 4}
            textAnchor="end"
            fontSize={8}
            fill="var(--voux-text-muted)"
          >
            y = x
          </text>

          {/* Axis labels */}
          <text
            x={padX + plotW / 2}
            y={svgH - 4}
            textAnchor="middle"
            fontSize={9}
            fill="var(--voux-text-muted)"
          >
            Probabilidade CRM
          </text>
          <text
            x={10}
            y={svgH / 2}
            textAnchor="middle"
            fontSize={9}
            fill="var(--voux-text-muted)"
            transform={`rotate(-90, 10, ${svgH / 2})`}
          >
            Taxa real
          </text>

          {/* Dots */}
          {dots.map(({ item, cx, cy, r }) => {
            const x = padX + cx * plotW;
            const y = padY + cy * plotH;
            const above = item.taxa_conversao_real > item.estrelas * 20;
            const color = above ? "#4caf7a" : "#c97565";
            return (
              <g
                key={item.estrelas}
                style={{ cursor: "default" }}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={color}
                  opacity={0.75}
                  stroke={color}
                  strokeWidth={1.5}
                />
                <text
                  x={x}
                  y={y + 4}
                  textAnchor="middle"
                  fontSize={Math.min(r - 2, 11)}
                  fontWeight="600"
                  fill="#fff"
                >
                  {item.estrelas}
                </text>
                <title>{`${item.estrelas}★ CRM | Taxa real: ${fmtPct(item.taxa_conversao_real)}\nTotal: ${fmtBRLKpi(item.valor_total)} | Ganhos: ${fmtNum(item.ganhos)} | Perdas: ${fmtNum(item.perdas)}\n${above ? "Acima da linha (subestimado)" : "Abaixo da linha (superestimado)"}`}</title>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export function ProbabilidadeVsResultado({ data, loading }: Props) {
  return (
    <ChartCard
      title="Probabilidade CRM vs. Resultado Real"
      description="Cada bolha = uma estrela (1-5). Eixo X = probabilidade CRM. Eixo Y = taxa de conversão real. Linha tracejada = referência y=x. Verde = acima (CRM subestimou); Vermelho = abaixo (superestimou)."
      loading={loading}
      height={300}
      footer={
        <div className="text-[10px] text-[var(--voux-text-muted)] font-mono">
          <span style={{ color: "#4caf7a" }}>●</span> Acima da linha = CRM subestimou |{" "}
          <span style={{ color: "#c97565" }}>●</span> Abaixo da linha = CRM superestimou |{" "}
          Tamanho da bolha = valor total
        </div>
      }
    >
      <ScatterChart data={data} />
    </ChartCard>
  );
}
