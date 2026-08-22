import React, { useState, useId } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import type { DesempenhoMensalItem } from "@/types/desempenhoVendas";

interface DesempenhoDualLineChartProps {
  data: DesempenhoMensalItem[];
  ano: number;
  loading?: boolean;
  className?: string;
}

function formatPointLabel(val: number): string {
  if (!val || val === 0) return "";
  if (val >= 1_000_000) {
    const formatted = (val / 1_000_000).toFixed(2).replace(".", ",");
    return `R$ ${formatted}M`;
  }
  if (val >= 1_000) {
    const formatted = (val / 1_000).toFixed(1).replace(".", ",");
    return `R$ ${formatted}k`;
  }
  return formatBRL(val);
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

export const DesempenhoDualLineChart: React.FC<DesempenhoDualLineChartProps> = ({
  data,
  ano,
  loading = false,
  className,
}) => {
  const uid = useId().replace(/:/g, "");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Totais
  const totalValorGanho = data.reduce((acc, d) => acc + d.valorGanho, 0);
  const totalQtdGanho = data.reduce((acc, d) => acc + d.qtdGanho, 0);
  const totalValorPerda = data.reduce((acc, d) => acc + d.valorPerda, 0);
  const totalQtdPerda = data.reduce((acc, d) => acc + d.qtdPerda, 0);

  // Dimensões do gráfico no padrão VOUX
  const width = 880;
  const height = 300;
  const padL = 30;
  const padR = 40;
  const padT = 30;
  const padB = 40;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  // Cada série ganha uma faixa/banda própria (metade superior e metade inferior)
  const bandGap = 28;
  const bandH = (plotH - bandGap) / 2;

  // Escalas e normalização individual
  const maxGanho = Math.max(...data.map((d) => d.valorGanho), 1);
  const maxPerda = Math.max(...data.map((d) => d.valorPerda), 1);

  const xCoord = (i: number) =>
    padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);

  // Faixa A (Ganhos): parte superior (de padT até padT + bandH)
  const bandATop = padT;
  const bandABottom = padT + bandH;
  const pointsA = data.map((d, i) => {
    const norm = d.valorGanho / maxGanho;
    const y = bandABottom - norm * (bandH - 24);
    return { x: xCoord(i), y, ...d };
  });

  // Faixa B (Perdas): parte inferior (de bandBTop até bandBBottom)
  const bandBTop = padT + bandH + bandGap;
  const bandBBottom = bandBTop + bandH;
  const pointsB = data.map((d, i) => {
    const norm = d.valorPerda / maxPerda;
    const y = bandBBottom - norm * (bandH - 24);
    return { x: xCoord(i), y, ...d };
  });

  const pathA = smoothPath(pointsA);
  const pathB = smoothPath(pointsB);

  // Áreas de preenchimento suaves
  const areaA = pointsA.length > 0
    ? `${pathA} L ${pointsA[pointsA.length - 1].x} ${bandABottom} L ${pointsA[0].x} ${bandABottom} Z`
    : "";

  const areaB = pointsB.length > 0
    ? `${pathB} L ${pointsB[pointsB.length - 1].x} ${bandBBottom} L ${pointsB[0].x} ${bandBBottom} Z`
    : "";

  const colorA = "#2d6a4f"; // Verde escuro elegante / VOUX
  const colorB = "#b83a28"; // Terracota escuro / VOUX

  const hoveredItem = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-5 md:p-6 shadow-sm",
        className
      )}
    >
      {/* Header no estilo do exemplo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
        <div>
          <p
            className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--voux-text-muted)]"
            style={{ fontFamily: "var(--voux-font-mono)" }}
          >
            HISTÓRICO MENSAL · DINÂMICA DE DESFECHOS
          </p>
          <h2
            className="text-[18px] md:text-[20px] font-bold tracking-tight text-[var(--voux-text-heading)] mt-0.5"
            style={{ fontFamily: "var(--voux-font-display)" }}
          >
            Ganhos vs. <span className="italic font-normal text-rose-700 dark:text-rose-400">Perdas</span> em {ano}
          </h2>
          <p className="text-xs text-[var(--voux-text-muted)] mt-0.5">
            Evolução de pedidos aprovados e negócios perdidos com escalas e eixos independentes.
          </p>
        </div>

        {/* Legenda compacta com bolinhas */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#2d6a4f] shrink-0" />
            <span className="text-[var(--voux-text-primary)]">
              Ganhos: <strong className="font-mono">{formatBRL(totalValorGanho)}</strong> ({totalQtdGanho} ped)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#b83a28] shrink-0" />
            <span className="text-[var(--voux-text-primary)]">
              Perdas: <strong className="font-mono">{formatBRL(totalValorPerda)}</strong> ({totalQtdPerda} neg)
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-[280px] w-full rounded-xl bg-[var(--voux-skeleton)]" />
      ) : (
        <div className="relative">
          {/* Canvas SVG com Faixas e Curvas que não se cruzam */}
          <div className="w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-[280px] overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id={`${uid}-gradA`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colorA} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={colorA} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id={`${uid}-gradB`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colorB} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={colorB} stopOpacity={0.02} />
                </linearGradient>
              </defs>

              {/* Linha guia suave de base para cada faixa */}
              <line
                x1={padL}
                y1={bandABottom}
                x2={width - padR}
                y2={bandABottom}
                stroke="currentColor"
                className="text-[var(--voux-card-border)]/50"
                strokeWidth="1"
              />
              <line
                x1={padL}
                y1={bandBBottom}
                x2={width - padR}
                y2={bandBBottom}
                stroke="currentColor"
                className="text-[var(--voux-card-border)]/50"
                strokeWidth="1"
              />

              {/* Áreas sob as curvas */}
              {areaA && <path d={areaA} fill={`url(#${uid}-gradA)`} />}
              {areaB && <path d={areaB} fill={`url(#${uid}-gradB)`} />}

              {/* Linha Superior (Ganhos) */}
              {pathA && (
                <path
                  d={pathA}
                  fill="none"
                  stroke={colorA}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Linha Inferior (Perdas) */}
              {pathB && (
                <path
                  d={pathB}
                  fill="none"
                  stroke={colorB}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Linha vertical de foco no hover */}
              {hoveredIndex !== null && (
                <line
                  x1={pointsA[hoveredIndex]?.x}
                  y1={padT - 10}
                  x2={pointsA[hoveredIndex]?.x}
                  y2={bandBBottom}
                  stroke="currentColor"
                  className="text-[var(--voux-text-muted)]"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
              )}

              {/* Pontos e Valores da Linha A (Ganhos) */}
              {pointsA.map((p, i) => {
                const isHovered = hoveredIndex === i;
                const hasValue = p.valorGanho > 0;
                const label = formatPointLabel(p.valorGanho);

                return (
                  <g key={`pt-a-${i}`}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 5 : hasValue ? 3.5 : 2}
                      fill={hasValue ? colorA : "var(--voux-card-border)"}
                      stroke="#ffffff"
                      strokeWidth={hasValue ? 1.5 : 1}
                    />

                    {/* Valor visível direto acima do ponto (estilo do print de inspiração) */}
                    {hasValue && (
                      <text
                        x={p.x}
                        y={p.y - 8}
                        textAnchor="middle"
                        className="text-[10px] font-mono font-semibold fill-[var(--voux-text-primary)]"
                      >
                        {label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Pontos e Valores da Linha B (Perdas) */}
              {pointsB.map((p, i) => {
                const isHovered = hoveredIndex === i;
                const hasValue = p.valorPerda > 0;
                const label = formatPointLabel(p.valorPerda);

                return (
                  <g key={`pt-b-${i}`}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 5 : hasValue ? 3.5 : 2}
                      fill={hasValue ? colorB : "var(--voux-card-border)"}
                      stroke="#ffffff"
                      strokeWidth={hasValue ? 1.5 : 1}
                    />

                    {/* Valor visível direto acima do ponto (estilo do print de inspiração) */}
                    {hasValue && (
                      <text
                        x={p.x}
                        y={p.y - 8}
                        textAnchor="middle"
                        className="text-[10px] font-mono font-semibold fill-[var(--voux-text-primary)]"
                      >
                        {label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Rótulos do Eixo X (Meses) */}
              {data.map((d, i) => {
                const x = xCoord(i);
                const isHovered = hoveredIndex === i;

                return (
                  <text
                    key={`lbl-x-${i}`}
                    x={x}
                    y={height - 8}
                    textAnchor="middle"
                    className={cn(
                      "text-[11px] font-mono transition-all",
                      isHovered
                        ? "fill-[var(--voux-text-primary)] font-bold text-[12px]"
                        : "fill-[var(--voux-text-muted)]"
                    )}
                  >
                    {d.mesNome}/{String(ano).slice(2)}
                  </text>
                );
              })}

              {/* Zonas transparentes de captura de hover */}
              {data.map((_, i) => {
                const x = xCoord(i);
                const colWidth = plotW / (data.length || 1);
                return (
                  <rect
                    key={`hit-${i}`}
                    x={x - colWidth / 2}
                    y={padT - 15}
                    width={colWidth}
                    height={plotH + 20}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                );
              })}
            </svg>
          </div>

          {/* Caixinha Tooltip Flutuante Detalhada ao Passar o Mouse (Elogiada pelo usuário) */}
          {hoveredItem && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--voux-card-border)] bg-[var(--surface-raised)]/95 backdrop-blur-md p-4 shadow-xl flex items-center gap-6 pointer-events-none z-30 text-xs">
              <div className="border-r border-[var(--voux-card-border)] pr-4">
                <p className="text-[10px] uppercase font-bold text-[var(--voux-text-muted)]">MÊS</p>
                <p className="text-[16px] font-bold text-[var(--voux-text-primary)] font-mono">
                  {hoveredItem.mesNome} / {ano}
                </p>
              </div>

              {/* Ganhos */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-[#2d6a4f]" />
                  <span>Ganhos:</span>
                </div>
                <p className="font-mono font-bold text-[14px] text-[var(--voux-text-primary)]">
                  {formatBRL(hoveredItem.valorGanho)}
                </p>
                <p className="text-[11px] text-[var(--voux-text-muted)] font-mono">
                  {hoveredItem.qtdGanho} pedido{hoveredItem.qtdGanho !== 1 ? "s" : ""} aprovado{hoveredItem.qtdGanho !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Perdas */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-[#b83a28]" />
                  <span>Perdas:</span>
                </div>
                <p className="font-mono font-bold text-[14px] text-[var(--voux-text-primary)]">
                  {formatBRL(hoveredItem.valorPerda)}
                </p>
                <p className="text-[11px] text-[var(--voux-text-muted)] font-mono">
                  {hoveredItem.qtdPerda} negócio{hoveredItem.qtdPerda !== 1 ? "s" : ""} perdido{hoveredItem.qtdPerda !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
