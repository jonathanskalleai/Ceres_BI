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

  // Escalas máximas independentes para que as curvas se sobreponham
  const maxGanho = Math.max(...data.map((d) => d.valorGanho), 1);
  const maxPerda = Math.max(...data.map((d) => d.valorPerda), 1);

  // Dimensões do viewBox SVG
  const width = 800;
  const height = 240;
  const padding = { top: 20, right: 50, bottom: 30, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calcula coordenadas dos pontos (x, y)
  const pointsGanho = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
    const y = padding.top + chartHeight - (d.valorGanho / maxGanho) * chartHeight;
    return { x, y, ...d };
  });

  const pointsPerda = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
    const y = padding.top + chartHeight - (d.valorPerda / maxPerda) * chartHeight;
    return { x, y, ...d };
  });

  // Linhas SVG Path com interpolação suave
  const createSmoothPath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return "";
    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      path += ` C ${cpX},${p0.y} ${cpX},${p1.y} ${p1.x},${p1.y}`;
    }
    return path;
  };

  const pathGanho = createSmoothPath(pointsGanho);
  const pathPerda = createSmoothPath(pointsPerda);

  // Áreas de preenchimento suave sob as curvas
  const areaGanho = pointsGanho.length > 0
    ? `${pathGanho} L ${pointsGanho[pointsGanho.length - 1].x},${padding.top + chartHeight} L ${pointsGanho[0].x},${padding.top + chartHeight} Z`
    : "";

  const areaPerda = pointsPerda.length > 0
    ? `${pathPerda} L ${pointsPerda[pointsPerda.length - 1].x},${padding.top + chartHeight} L ${pointsPerda[0].x},${padding.top + chartHeight} Z`
    : "";

  const hoveredItem = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-5 md:p-6 shadow-sm",
        className
      )}
    >
      {/* Header com Título e Badges dos Eixos Independentes */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <p
            className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--voux-text-muted)]"
            style={{ fontFamily: "var(--voux-font-mono)" }}
          >
            DINÂMICA ANUAL · DUPLO EIXO DE VALOR
          </p>
          <h2
            className="text-[18px] md:text-[20px] font-bold tracking-tight text-[var(--voux-text-heading)] mt-0.5"
            style={{ fontFamily: "var(--voux-font-display)" }}
          >
            Ganhos vs. Perdas em {ano}
          </h2>
          <p className="text-xs text-[var(--voux-text-muted)] mt-0.5">
            Evolução mensal comparativa de pedidos aprovados (ganhos) versus negócios perdidos.
          </p>
        </div>

        {/* Badges de Legenda com Totais */}
        <div className="flex items-center gap-3 flex-wrap font-mono">
          {/* Badge Ganhos */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-semibold text-emerald-600 dark:text-emerald-400">
                Ganhos (Eixo Esq.)
              </span>
              <span className="font-bold">
                {formatBRL(totalValorGanho)} <span className="font-normal opacity-80">({totalQtdGanho} ped)</span>
              </span>
            </div>
          </div>

          {/* Badge Perdas */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300 text-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-semibold text-rose-600 dark:text-rose-400">
                Perdas (Eixo Dir.)
              </span>
              <span className="font-bold">
                {formatBRL(totalValorPerda)} <span className="font-normal opacity-80">({totalQtdPerda} neg)</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <Skeleton className="h-[220px] w-full rounded-xl bg-[var(--voux-skeleton)]" />
      ) : (
        <div className="relative">
          {/* Gráfico SVG */}
          <div className="w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-[220px] overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id={`${uid}-grad-ganho`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id={`${uid}-grad-perda`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Linhas de Grade Horizontal */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = padding.top + chartHeight * (1 - ratio);
                return (
                  <line
                    key={ratio}
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="currentColor"
                    className="text-[var(--voux-card-border)]"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Área Sombreada */}
              {areaGanho && <path d={areaGanho} fill={`url(#${uid}-grad-ganho)`} />}
              {areaPerda && <path d={areaPerda} fill={`url(#${uid}-grad-perda)`} />}

              {/* Linha Ganhos (Verde) */}
              {pathGanho && (
                <path
                  d={pathGanho}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Linha Perdas (Rosa/Vermelho) */}
              {pathPerda && (
                <path
                  d={pathPerda}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Pontos Interativos */}
              {pointsGanho.map((p, i) => (
                <circle
                  key={`pt-g-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={hoveredIndex === i ? 5 : 3.5}
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className="transition-all duration-150"
                />
              ))}

              {pointsPerda.map((p, i) => (
                <circle
                  key={`pt-p-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={hoveredIndex === i ? 5 : 3.5}
                  fill="#f43f5e"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className="transition-all duration-150"
                />
              ))}

              {/* Linha vertical de foco no hover */}
              {hoveredIndex !== null && (
                <line
                  x1={pointsGanho[hoveredIndex]?.x}
                  y1={padding.top}
                  x2={pointsGanho[hoveredIndex]?.x}
                  y2={padding.top + chartHeight}
                  stroke="currentColor"
                  className="text-[var(--voux-text-muted)]"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
              )}

              {/* Rótulos do Eixo X (Meses) */}
              {data.map((d, i) => {
                const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
                return (
                  <text
                    key={`lbl-${i}`}
                    x={x}
                    y={height - 8}
                    textAnchor="middle"
                    className="text-[11px] font-mono fill-[var(--voux-text-muted)]"
                  >
                    {d.mesNome}
                  </text>
                );
              })}

              {/* Rótulos do Eixo Y Esquerdo (Ganhos) */}
              <text
                x={padding.left - 8}
                y={padding.top + 10}
                textAnchor="end"
                className="text-[10px] font-mono font-semibold fill-emerald-600 dark:fill-emerald-400"
              >
                {formatBRL(maxGanho)}
              </text>
              <text
                x={padding.left - 8}
                y={padding.top + chartHeight}
                textAnchor="end"
                className="text-[10px] font-mono fill-[var(--voux-text-muted)]"
              >
                R$ 0
              </text>

              {/* Rótulos do Eixo Y Direito (Perdas) */}
              <text
                x={width - padding.right + 8}
                y={padding.top + 10}
                textAnchor="start"
                className="text-[10px] font-mono font-semibold fill-rose-600 dark:fill-rose-400"
              >
                {formatBRL(maxPerda)}
              </text>
              <text
                x={width - padding.right + 8}
                y={padding.top + chartHeight}
                textAnchor="start"
                className="text-[10px] font-mono fill-[var(--voux-text-muted)]"
              >
                R$ 0
              </text>

              {/* Zonas invisíveis para detecção de hover em cada mês */}
              {data.map((_, i) => {
                const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
                const colWidth = chartWidth / (data.length || 1);
                return (
                  <rect
                    key={`zone-${i}`}
                    x={x - colWidth / 2}
                    y={padding.top}
                    width={colWidth}
                    height={chartHeight}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                );
              })}
            </svg>
          </div>

          {/* Tooltip Detalhado no Hover */}
          {hoveredItem && (
            <div
              className="absolute top-2 left-1/2 -translate-x-1/2 rounded-xl border border-[var(--voux-card-border)] bg-[var(--surface-raised)]/95 backdrop-blur-md p-3 shadow-lg flex items-center gap-6 pointer-events-none z-20 text-xs"
            >
              <div className="border-r border-[var(--voux-card-border)] pr-4">
                <p className="text-[10px] uppercase font-bold text-[var(--voux-text-muted)]">MÊS</p>
                <p className="text-[14px] font-bold text-[var(--voux-text-primary)]">
                  {hoveredItem.mesNome} / {ano}
                </p>
              </div>

              {/* Ganhos */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Ganhos:</span>
                </div>
                <p className="font-mono font-bold text-[13px] text-[var(--voux-text-primary)]">
                  {formatBRL(hoveredItem.valorGanho)}
                </p>
                <p className="text-[10px] text-[var(--voux-text-muted)] font-mono">
                  {hoveredItem.qtdGanho} pedido{hoveredItem.qtdGanho !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Perdas */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  <span>Perdas:</span>
                </div>
                <p className="font-mono font-bold text-[13px] text-[var(--voux-text-primary)]">
                  {formatBRL(hoveredItem.valorPerda)}
                </p>
                <p className="text-[10px] text-[var(--voux-text-muted)] font-mono">
                  {hoveredItem.qtdPerda} negócio{hoveredItem.qtdPerda !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
