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

function formatCompactBRL(val: number): string {
  if (!val || val === 0) return "R$ 0";
  if (val >= 1_000_000) {
    const formatted = (val / 1_000_000).toFixed(1).replace(".", ",");
    return `R$ ${formatted.endsWith(",0") ? formatted.slice(0, -2) : formatted}M`;
  }
  if (val >= 1_000) {
    return `R$ ${Math.round(val / 1_000)}k`;
  }
  return `R$ ${Math.round(val)}`;
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

  // Dimensões
  const width = 860;
  const trackHeight = 110;
  const padding = { top: 28, right: 35, bottom: 20, left: 60 };
  const chartWidth = width - padding.left - padding.right;

  // Escalas máximas individuais
  const maxGanho = Math.max(...data.map((d) => d.valorGanho), 1);
  const maxPerda = Math.max(...data.map((d) => d.valorPerda), 1);

  // Pontos para a Faixa 1 (Ganhos)
  const pointsGanho = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
    const innerH = trackHeight - padding.top - padding.bottom;
    const y = padding.top + innerH - (d.valorGanho / maxGanho) * innerH;
    return { x, y, ...d };
  });

  // Pontos para a Faixa 2 (Perdas)
  const pointsPerda = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
    const innerH = trackHeight - padding.top - padding.bottom;
    const y = padding.top + innerH - (d.valorPerda / maxPerda) * innerH;
    return { x, y, ...d };
  });

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

  const innerH = trackHeight - padding.top - padding.bottom;
  const baselineY = padding.top + innerH;

  const areaGanho = pointsGanho.length > 0
    ? `${pathGanho} L ${pointsGanho[pointsGanho.length - 1].x},${baselineY} L ${pointsGanho[0].x},${baselineY} Z`
    : "";

  const areaPerda = pointsPerda.length > 0
    ? `${pathPerda} L ${pointsPerda[pointsPerda.length - 1].x},${baselineY} L ${pointsPerda[0].x},${baselineY} Z`
    : "";

  const hoveredItem = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-5 md:p-6 shadow-sm",
        className
      )}
    >
      {/* Header com Título e Badges */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
        <div>
          <p
            className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--voux-text-muted)]"
            style={{ fontFamily: "var(--voux-font-mono)" }}
          >
            EVOLUÇÃO MENSAL · FAIXAS INDEPENDENTES
          </p>
          <h2
            className="text-[18px] md:text-[20px] font-bold tracking-tight text-[var(--voux-text-heading)] mt-0.5"
            style={{ fontFamily: "var(--voux-font-display)" }}
          >
            Ganhos vs. Perdas em {ano}
          </h2>
          <p className="text-xs text-[var(--voux-text-muted)] mt-0.5">
            Visualização paralela dos valores e quantidades mês a mês sem sobreposição de linhas.
          </p>
        </div>

        {/* Badges com Totais do Ano */}
        <div className="flex items-center gap-3 flex-wrap font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-semibold text-emerald-600 dark:text-emerald-400">
                Total Ganhos no Ano
              </span>
              <span className="font-bold">
                {formatBRL(totalValorGanho)} <span className="font-normal opacity-80">({totalQtdGanho} pedidos)</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300 text-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-semibold text-rose-600 dark:text-rose-400">
                Total Perdas no Ano
              </span>
              <span className="font-bold">
                {formatBRL(totalValorPerda)} <span className="font-normal opacity-80">({totalQtdPerda} negócios)</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-[280px] w-full rounded-xl bg-[var(--voux-skeleton)]" />
      ) : (
        <div className="relative space-y-3 mt-2">
          {/* FAIXA 1: GANHOS (Eixo Próprio) */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-3">
            <div className="flex items-center justify-between px-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-mono">
                  Ganhos (Pedidos Aprovados)
                </span>
              </div>
              <span className="text-[10px] font-mono text-[var(--voux-text-muted)]">
                Teto mensal: <strong>{formatCompactBRL(maxGanho)}</strong>
              </span>
            </div>

            <div className="w-full overflow-hidden">
              <svg viewBox={`0 0 ${width} ${trackHeight}`} className="w-full h-[120px] overflow-visible" preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`${uid}-grad-ganho`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.30" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grade de fundo */}
                {[0, 0.5, 1].map((ratio) => {
                  const y = padding.top + innerH * (1 - ratio);
                  return (
                    <line
                      key={ratio}
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke="currentColor"
                      className="text-[var(--voux-card-border)]/60"
                      strokeDasharray="2 2"
                      strokeWidth="1"
                    />
                  );
                })}

                {/* Área sob a curva */}
                {areaGanho && <path d={areaGanho} fill={`url(#${uid}-grad-ganho)`} />}

                {/* Linha da curva */}
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

                {/* Linha vertical de foco no hover */}
                {hoveredIndex !== null && (
                  <line
                    x1={pointsGanho[hoveredIndex]?.x}
                    y1={padding.top - 10}
                    x2={pointsGanho[hoveredIndex]?.x}
                    y2={baselineY}
                    stroke="#10b981"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Pontos e Valores Fixos (Visíveis Direto sem Hover) */}
                {pointsGanho.map((p, i) => {
                  const isHovered = hoveredIndex === i;
                  const hasValue = p.valorGanho > 0;

                  return (
                    <g key={`pt-g-${i}`}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isHovered ? 5.5 : hasValue ? 4 : 2.5}
                        fill={hasValue ? "#10b981" : "var(--voux-card-border)"}
                        stroke="#ffffff"
                        strokeWidth={hasValue ? 1.5 : 1}
                      />

                      {/* Rótulo de Valor Fixo Visível Direto */}
                      {hasValue && (
                        <text
                          x={p.x}
                          y={Math.max(padding.top - 10, p.y - 8)}
                          textAnchor="middle"
                          className="text-[10px] font-mono font-bold fill-emerald-800 dark:fill-emerald-300"
                        >
                          {formatCompactBRL(p.valorGanho)}
                        </text>
                      )}

                      {/* Contagem de unidades */}
                      {hasValue && (
                        <text
                          x={p.x}
                          y={baselineY + 12}
                          textAnchor="middle"
                          className="text-[9px] font-mono fill-[var(--voux-text-muted)]"
                        >
                          {p.qtdGanho} un
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* FAIXA 2: PERDAS (Eixo Próprio) */}
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.03] p-3">
            <div className="flex items-center justify-between px-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 font-mono">
                  Perdas (Negócios Perdidos)
                </span>
              </div>
              <span className="text-[10px] font-mono text-[var(--voux-text-muted)]">
                Teto mensal: <strong>{formatCompactBRL(maxPerda)}</strong>
              </span>
            </div>

            <div className="w-full overflow-hidden">
              <svg viewBox={`0 0 ${width} ${trackHeight}`} className="w-full h-[120px] overflow-visible" preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`${uid}-grad-perda`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grade de fundo */}
                {[0, 0.5, 1].map((ratio) => {
                  const y = padding.top + innerH * (1 - ratio);
                  return (
                    <line
                      key={ratio}
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke="currentColor"
                      className="text-[var(--voux-card-border)]/60"
                      strokeDasharray="2 2"
                      strokeWidth="1"
                    />
                  );
                })}

                {/* Área sob a curva */}
                {areaPerda && <path d={areaPerda} fill={`url(#${uid}-grad-perda)`} />}

                {/* Linha da curva */}
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

                {/* Linha vertical de foco no hover */}
                {hoveredIndex !== null && (
                  <line
                    x1={pointsPerda[hoveredIndex]?.x}
                    y1={padding.top - 10}
                    x2={pointsPerda[hoveredIndex]?.x}
                    y2={baselineY}
                    stroke="#f43f5e"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Pontos e Valores Fixos (Visíveis Direto sem Hover) */}
                {pointsPerda.map((p, i) => {
                  const isHovered = hoveredIndex === i;
                  const hasValue = p.valorPerda > 0;

                  return (
                    <g key={`pt-p-${i}`}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isHovered ? 5.5 : hasValue ? 4 : 2.5}
                        fill={hasValue ? "#f43f5e" : "var(--voux-card-border)"}
                        stroke="#ffffff"
                        strokeWidth={hasValue ? 1.5 : 1}
                      />

                      {/* Rótulo de Valor Fixo Visível Direto */}
                      {hasValue && (
                        <text
                          x={p.x}
                          y={Math.max(padding.top - 10, p.y - 8)}
                          textAnchor="middle"
                          className="text-[10px] font-mono font-bold fill-rose-800 dark:fill-rose-300"
                        >
                          {formatCompactBRL(p.valorPerda)}
                        </text>
                      )}

                      {/* Contagem de unidades */}
                      {hasValue && (
                        <text
                          x={p.x}
                          y={baselineY + 12}
                          textAnchor="middle"
                          className="text-[9px] font-mono fill-[var(--voux-text-muted)]"
                        >
                          {p.qtdPerda} un
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Barra de Meses Sincronizada com Zonas de Hover */}
          <div className="grid grid-cols-12 gap-1 pt-1">
            {data.map((d, i) => {
              const isHovered = hoveredIndex === i;
              return (
                <div
                  key={`month-col-${i}`}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className={cn(
                    "text-center py-1.5 rounded-lg cursor-pointer transition-all",
                    isHovered
                      ? "bg-emerald-500/20 font-bold text-emerald-800 dark:text-emerald-300 shadow-sm"
                      : "hover:bg-[var(--voux-card-border)]/40 text-[var(--voux-text-primary)]"
                  )}
                >
                  <p className="text-[11px] font-mono font-semibold">{d.mesNome}</p>
                </div>
              );
            })}
          </div>

          {/* Tooltip Flutuante Detalhado ao Passar o Mouse */}
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
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
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
                <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
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
