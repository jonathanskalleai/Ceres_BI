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

/** Formata valor compacto para o eixo Y */
function formatAxisValue(val: number): string {
  if (!val || val === 0) return "R$ 0";
  if (val >= 1_000_000) {
    const num = (val / 1_000_000).toFixed(1).replace(".", ",");
    return `R$ ${num.endsWith(",0") ? num.slice(0, -2) : num}M`;
  }
  if (val >= 1_000) {
    return `R$ ${Math.round(val / 1_000)}k`;
  }
  return `R$ ${Math.round(val)}`;
}

/** Gera curva Bezier suave natural e elegante */
function getSmoothBezier(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx.toFixed(2)} ${prev.y.toFixed(2)}, ${cpx.toFixed(2)} ${curr.y.toFixed(2)}, ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
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

  // Dimensões do gráfico
  const width = 960;
  const height = 280;
  const padding = { top: 35, right: 65, bottom: 40, left: 65 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Escalas máximas
  const maxGanho = Math.max(...data.map((d) => d.valorGanho), 1);
  const maxPerda = Math.max(...data.map((d) => d.valorPerda), 1);

  const xCoord = (i: number) =>
    padding.left + (data.length <= 1 ? chartWidth / 2 : (i / (data.length - 1)) * chartWidth);

  // Coordenadas das curvas
  const pointsGanho = data.map((d, i) => {
    const norm = maxGanho > 0 ? d.valorGanho / maxGanho : 0;
    const y = padding.top + chartHeight - norm * chartHeight;
    return { x: xCoord(i), y, ...d };
  });

  const pointsPerda = data.map((d, i) => {
    const norm = maxPerda > 0 ? d.valorPerda / maxPerda : 0;
    const y = padding.top + chartHeight - norm * chartHeight;
    return { x: xCoord(i), y, ...d };
  });

  const pathGanho = getSmoothBezier(pointsGanho);
  const pathPerda = getSmoothBezier(pointsPerda);

  // Áreas sob as curvas
  const areaGanho = pointsGanho.length > 0
    ? `${pathGanho} L ${pointsGanho[pointsGanho.length - 1].x} ${padding.top + chartHeight} L ${pointsGanho[0].x} ${padding.top + chartHeight} Z`
    : "";

  const areaPerda = pointsPerda.length > 0
    ? `${pathPerda} L ${pointsPerda[pointsPerda.length - 1].x} ${padding.top + chartHeight} L ${pointsPerda[0].x} ${padding.top + chartHeight} Z`
    : "";

  const hoveredItem = hoveredIndex !== null ? data[hoveredIndex] : null;

  // Posição horizontal do tooltip flutuante
  const tooltipX = hoveredIndex !== null && pointsGanho[hoveredIndex]
    ? Math.max(160, Math.min(width - 160, pointsGanho[hoveredIndex].x))
    : width / 2;

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-5 md:p-6 shadow-sm",
        className
      )}
    >
      {/* Header no Estilo Editorial VOUX */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
        <div>
          <p
            className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--voux-text-muted)] font-mono"
          >
            HISTÓRICO MENSAL · RESULTADOS CONSOLIDADOS
          </p>
          <h2
            className="text-[20px] md:text-[22px] font-bold tracking-tight text-[var(--voux-text-heading)] mt-0.5"
            style={{ fontFamily: "var(--voux-font-display)" }}
          >
            Desfechos de Vendas em <span className="italic font-normal text-emerald-700 dark:text-emerald-400">{ano}</span>
          </h2>
          <p className="text-xs text-[var(--voux-text-muted)] mt-0.5 font-sans">
            Curvas comparativas de pedidos aprovados e negócios perdidos ao longo do ano.
          </p>
        </div>

        {/* Legenda com Marcadores Redondos */}
        <div className="flex items-center gap-5 text-xs font-sans">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-600 shrink-0" />
            <span className="text-[var(--voux-text-primary)] font-medium">
              Ganhos: <strong className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatBRL(totalValorGanho)}</strong> ({totalQtdGanho} ped)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-600 shrink-0" />
            <span className="text-[var(--voux-text-primary)] font-medium">
              Perdas: <strong className="font-mono font-bold text-red-600 dark:text-red-400">{formatBRL(totalValorPerda)}</strong> ({totalQtdPerda} neg)
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-[280px] w-full rounded-xl bg-[var(--voux-skeleton)]" />
      ) : (
        <div className="relative">
          {/* Canvas SVG do Gráfico Unificado */}
          <div className="w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-[280px] overflow-visible"
              preserveAspectRatio="none"
              shapeRendering="geometricPrecision"
              textRendering="geometricPrecision"
            >
              <defs>
                {/* Gradiente Área Ganhos */}
                <linearGradient id={`${uid}-grad-ganho`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.16" />
                  <stop offset="60%" stopColor="#10b981" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
                </linearGradient>

                {/* Gradiente Área Perdas */}
                <linearGradient id={`${uid}-grad-perda`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.12" />
                  <stop offset="60%" stopColor="#ef4444" stopOpacity="0.03" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.00" />
                </linearGradient>

                {/* Laser de Foco Vertical */}
                <linearGradient id={`${uid}-laser`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.0" />
                  <stop offset="50%" stopColor="currentColor" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* 4 Linhas de Grade Horizontais */}
              {[0, 0.33, 0.66, 1].map((pct, idx) => {
                const y = padding.top + chartHeight * pct;
                return (
                  <line
                    key={`grid-${idx}`}
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="currentColor"
                    className="text-[var(--voux-card-border)]/70"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Áreas Preenchidas sob as Curvas */}
              {areaGanho && <path d={areaGanho} fill={`url(#${uid}-grad-ganho)`} />}
              {areaPerda && <path d={areaPerda} fill={`url(#${uid}-grad-perda)`} />}

              {/* Linha 1: Ganhos (Esmeralda) */}
              {pathGanho && (
                <path
                  d={pathGanho}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Linha 2: Perdas (Vermelho) */}
              {pathPerda && (
                <path
                  d={pathPerda}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Régua Laser Vertical de Foco no Hover */}
              {hoveredIndex !== null && pointsGanho[hoveredIndex] && (
                <line
                  x1={pointsGanho[hoveredIndex].x}
                  y1={padding.top - 10}
                  x2={pointsGanho[hoveredIndex].x}
                  y2={padding.top + chartHeight + 10}
                  stroke={`url(#${uid}-laser)`}
                  className="text-[var(--voux-text-primary)]"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
              )}

              {/* Pontos da Linha Ganhos */}
              {pointsGanho.map((p, i) => {
                const isHovered = hoveredIndex === i;
                const hasValue = p.valorGanho > 0;
                return (
                  <g key={`pt-g-${i}`}>
                    {isHovered && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="8.5"
                        fill="#10b981"
                        fillOpacity="0.25"
                      />
                    )}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 5.5 : hasValue ? 3.5 : 2}
                      fill={hasValue ? "#10b981" : "var(--voux-card-border)"}
                      stroke="#ffffff"
                      strokeWidth={hasValue ? 1.5 : 1}
                      className="transition-all duration-150"
                    />
                  </g>
                );
              })}

              {/* Pontos da Linha Perdas */}
              {pointsPerda.map((p, i) => {
                const isHovered = hoveredIndex === i;
                const hasValue = p.valorPerda > 0;
                return (
                  <g key={`pt-p-${i}`}>
                    {isHovered && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="8.5"
                        fill="#ef4444"
                        fillOpacity="0.25"
                      />
                    )}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 5.5 : hasValue ? 3.5 : 2}
                      fill={hasValue ? "#ef4444" : "var(--voux-card-border)"}
                      stroke="#ffffff"
                      strokeWidth={hasValue ? 1.5 : 1}
                      className="transition-all duration-150"
                    />
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
                    y={height - 12}
                    textAnchor="middle"
                    className={cn(
                      "text-[11px] font-sans transition-all",
                      isHovered
                        ? "fill-[var(--voux-text-primary)] font-bold text-[12px]"
                        : "fill-[var(--voux-text-muted)] font-medium"
                    )}
                  >
                    {d.mesNome}
                  </text>
                );
              })}

              {/* Eixo Y Esquerdo: Escala de Ganhos (Verde) */}
              <text
                x={padding.left - 10}
                y={padding.top + 4}
                textAnchor="end"
                className="text-[10px] font-mono font-semibold fill-emerald-600 dark:fill-emerald-400"
              >
                {formatAxisValue(maxGanho)}
              </text>
              <text
                x={padding.left - 10}
                y={padding.top + chartHeight}
                textAnchor="end"
                className="text-[10px] font-mono fill-[var(--voux-text-muted)]"
              >
                R$ 0
              </text>

              {/* Eixo Y Direito: Escala de Perdas (Vermelho) */}
              <text
                x={width - padding.right + 10}
                y={padding.top + 4}
                textAnchor="start"
                className="text-[10px] font-mono font-semibold fill-red-600 dark:fill-red-400"
              >
                {formatAxisValue(maxPerda)}
              </text>
              <text
                x={width - padding.right + 10}
                y={padding.top + chartHeight}
                textAnchor="start"
                className="text-[10px] font-mono fill-[var(--voux-text-muted)]"
              >
                R$ 0
              </text>

              {/* Zonas de Detecção de Hover em cada Mês */}
              {data.map((_, i) => {
                const x = xCoord(i);
                const colWidth = chartWidth / (data.length || 1);
                return (
                  <rect
                    key={`hit-${i}`}
                    x={x - colWidth / 2}
                    y={padding.top - 20}
                    width={colWidth}
                    height={chartHeight + 35}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                );
              })}
            </svg>
          </div>

          {/* Caixinha Tooltip Flutuante em Vidro Fosco Apple (Frosted Glassmorphism) */}
          {hoveredItem && (
            <div
              className="absolute top-2 rounded-2xl border border-white/80 dark:border-white/20 bg-white/90 dark:bg-[#121c24]/90 backdrop-blur-xl backdrop-saturate-150 p-4 shadow-[0_16px_36px_-6px_rgba(0,0,0,0.18),0_0_0_1px_rgba(255,255,255,0.6)] dark:shadow-[0_20px_40px_-6px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.1)] flex items-center gap-6 pointer-events-none z-30 text-xs animate-in fade-in zoom-in-95 duration-150 -translate-x-1/2"
              style={{ left: `${(tooltipX / width) * 100}%` }}
            >
              <div className="border-r border-[var(--voux-card-border)] pr-4">
                <p className="text-[10px] uppercase font-bold text-[var(--voux-text-muted)] font-mono">MÊS</p>
                <p className="text-[16px] font-bold text-[var(--voux-text-primary)] font-mono">
                  {hoveredItem.mesNome} / {ano}
                </p>
              </div>

              {/* Ganhos */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
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
                <div className="flex items-center gap-1.5 font-semibold text-red-600 dark:text-red-400">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
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
