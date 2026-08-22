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

/** Cubic bezier smooth path */
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

  // Totais do ano
  const totalValorGanho = data.reduce((acc, d) => acc + d.valorGanho, 0);
  const totalQtdGanho = data.reduce((acc, d) => acc + d.qtdGanho, 0);
  const totalValorPerda = data.reduce((acc, d) => acc + d.valorPerda, 0);
  const totalQtdPerda = data.reduce((acc, d) => acc + d.qtdPerda, 0);

  // Dimensões do gráfico unificado
  const width = 920;
  const height = 300;
  const padL = 35;
  const padR = 45;
  const padT = 40;
  const padB = 45;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  // Escalas e normalizações independentes para que ambas as linhas aproveitem a altura do gráfico
  const maxGanho = Math.max(...data.map((d) => d.valorGanho), 1);
  const maxPerda = Math.max(...data.map((d) => d.valorPerda), 1);

  const xCoord = (i: number) =>
    padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);

  // Coordenadas das curvas (Ganhos na faixa superior/média e Perdas na faixa média/inferior)
  const pointsGanho = data.map((d, i) => {
    const norm = d.valorGanho / maxGanho;
    // Ganhos: varia do topo (y = padT) até 65% da altura
    const y = padT + plotH * 0.55 - norm * (plotH * 0.45);
    return { x: xCoord(i), y, ...d };
  });

  const pointsPerda = data.map((d, i) => {
    const norm = d.valorPerda / maxPerda;
    // Perdas: varia da base (y = padT + plotH) até 40% da altura
    const y = padT + plotH - norm * (plotH * 0.45);
    return { x: xCoord(i), y, ...d };
  });

  const pathGanho = smoothPath(pointsGanho);
  const pathPerda = smoothPath(pointsPerda);

  // Área única e suave no fundo do gráfico
  const areaBottom = pointsPerda.length > 0
    ? `${pathPerda} L ${pointsPerda[pointsPerda.length - 1].x} ${padT + plotH} L ${pointsPerda[0].x} ${padT + plotH} Z`
    : "";

  const colorGanho = "#2b2824"; // Escuro elegante / Graphite da referência
  const colorPerda = "#b83a28"; // Terracota / Vinho da referência

  const hoveredItem = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-6 md:p-7 shadow-sm",
        className
      )}
    >
      {/* Header com Tipografia VOUX Idêntica à Inspiração */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <p
            className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--voux-text-muted)]"
            style={{ fontFamily: "var(--voux-font-mono)" }}
          >
            HISTÓRICO MENSAL · RESULTADOS CONSOLIDADOS
          </p>
          <h2
            className="text-[20px] md:text-[22px] font-bold tracking-tight text-[var(--voux-text-heading)] mt-0.5"
            style={{ fontFamily: "var(--voux-font-display)" }}
          >
            Desfechos de Vendas em <span className="italic font-normal text-rose-700 dark:text-rose-400">{ano}</span>
          </h2>
          <p className="text-xs text-[var(--voux-text-muted)] mt-0.5 font-sans">
            Curvas mensais comparativas com escalas independentes por desfecho.
          </p>
        </div>

        {/* Legenda com Marcadores Redondos estilo Inspiração */}
        <div className="flex items-center gap-5 text-xs font-sans">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#2b2824] dark:bg-emerald-400 shrink-0" />
            <span className="text-[var(--voux-text-primary)] font-medium">
              Ganhos: <strong className="font-mono font-bold">{formatBRL(totalValorGanho)}</strong> ({totalQtdGanho} pedidos)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#b83a28] shrink-0" />
            <span className="text-[var(--voux-text-primary)] font-medium">
              Perdas: <strong className="font-mono font-bold">{formatBRL(totalValorPerda)}</strong> ({totalQtdPerda} negócios)
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-[280px] w-full rounded-xl bg-[var(--voux-skeleton)]" />
      ) : (
        <div className="relative">
          {/* Canvas SVG do Gráfico Único */}
          <div className="w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-[280px] overflow-visible"
              preserveAspectRatio="none"
              shapeRendering="geometricPrecision"
              textRendering="geometricPrecision"
            >
              <defs>
                <linearGradient id={`${uid}-ambient`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#b83a28" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#b83a28" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Área suave única no fundo */}
              {areaBottom && <path d={areaBottom} fill={`url(#${uid}-ambient)`} />}

              {/* Linha 1: Ganhos (Curva Suave Superior) */}
              {pathGanho && (
                <path
                  d={pathGanho}
                  fill="none"
                  stroke={colorGanho}
                  className="dark:stroke-emerald-400"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Linha 2: Perdas (Curva Suave Inferior) */}
              {pathPerda && (
                <path
                  d={pathPerda}
                  fill="none"
                  stroke={colorPerda}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Linha vertical de foco no hover */}
              {hoveredIndex !== null && (
                <line
                  x1={pointsGanho[hoveredIndex]?.x}
                  y1={padT - 15}
                  x2={pointsGanho[hoveredIndex]?.x}
                  y2={padT + plotH + 5}
                  stroke="currentColor"
                  className="text-[var(--voux-text-muted)]"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              )}

              {/* Pontos e Valores da Linha Ganhos (Tipografia Refinada da Inspiração) */}
              {pointsGanho.map((p, i) => {
                const isHovered = hoveredIndex === i;
                const hasValue = p.valorGanho > 0;

                return (
                  <g key={`pt-g-${i}`}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 5.5 : hasValue ? 4 : 2}
                      fill={hasValue ? colorGanho : "var(--voux-card-border)"}
                      className="dark:fill-emerald-400"
                      stroke="#ffffff"
                      strokeWidth={hasValue ? 1.5 : 1}
                    />

                    {/* Valor Visível Direto com Tipografia Elegante */}
                    {hasValue && (
                      <text
                        x={p.x}
                        y={p.y - 9}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="600"
                        fill="var(--voux-text-heading, #1a1714)"
                        fontFamily="var(--voux-font-sans)"
                        letterSpacing="-0.01em"
                      >
                        {formatBRL(p.valorGanho)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Pontos e Valores da Linha Perdas (Tipografia Refinada da Inspiração) */}
              {pointsPerda.map((p, i) => {
                const isHovered = hoveredIndex === i;
                const hasValue = p.valorPerda > 0;

                return (
                  <g key={`pt-p-${i}`}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 5.5 : hasValue ? 4 : 2}
                      fill={hasValue ? colorPerda : "var(--voux-card-border)"}
                      stroke="#ffffff"
                      strokeWidth={hasValue ? 1.5 : 1}
                    />

                    {/* Valor Visível Direto com Tipografia Elegante */}
                    {hasValue && (
                      <text
                        x={p.x}
                        y={p.y - 9}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="600"
                        fill="var(--voux-text-heading, #1a1714)"
                        fontFamily="var(--voux-font-sans)"
                        letterSpacing="-0.01em"
                      >
                        {formatBRL(p.valorPerda)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Rótulos do Eixo X (Meses no formato mmm/aa) */}
              {data.map((d, i) => {
                const x = xCoord(i);
                const isHovered = hoveredIndex === i;

                return (
                  <text
                    key={`lbl-x-${i}`}
                    x={x}
                    y={height - 10}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight={isHovered ? "700" : "500"}
                    fill={isHovered ? "var(--voux-text-primary)" : "var(--voux-text-muted)"}
                    fontFamily="var(--voux-font-sans)"
                  >
                    {d.mesNome.toLowerCase()}/{String(ano).slice(2)}
                  </text>
                );
              })}

              {/* Zonas de captura de hover */}
              {data.map((_, i) => {
                const x = xCoord(i);
                const colWidth = plotW / (data.length || 1);
                return (
                  <rect
                    key={`hit-${i}`}
                    x={x - colWidth / 2}
                    y={padT - 20}
                    width={colWidth}
                    height={plotH + 35}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                );
              })}
            </svg>
          </div>

          {/* Caixinha Tooltip Flutuante Detalhada ao Passar o Mouse */}
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
                <div className="flex items-center gap-1.5 font-semibold text-[var(--voux-text-primary)]">
                  <span className="h-2 w-2 rounded-full bg-[#2b2824] dark:bg-emerald-400" />
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
                <div className="flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-400">
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
