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

/** Formata valor compacto e limpo para as legendas em cima de cada bolinha */
function formatCompactValue(val: number): string {
  if (!val || val === 0) return "";
  if (val >= 1_000_000) {
    const num = (val / 1_000_000).toFixed(1).replace(".", ",");
    return `R$ ${num.endsWith(",0") ? num.slice(0, -2) : num}M`;
  }
  if (val >= 1_000) {
    return `R$ ${Math.round(val / 1_000)}k`;
  }
  return `R$ ${Math.round(val)}`;
}

/** Formata valor do eixo Y */
function formatYAxis(val: number): string {
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

/** 
 * Gera curva arredondada, suave e acentuada (Cardinal Spline com continuidade natural)
 * Cria a curvatura suave e fluida que conecta os pontos sem cantos retos
 */
function getSmoothCurvedPath(points: { x: number; y: number }[], tension = 0.3): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  if (n === 2) {
    const p0 = points[0];
    const p1 = points[1];
    const dx = p1.x - p0.x;
    return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} C ${(p0.x + dx * 0.35).toFixed(2)} ${p0.y.toFixed(2)}, ${(p1.x - dx * 0.35).toFixed(2)} ${p1.y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 0; i < n - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < n - 2 ? points[i + 2] : p2;

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * (1 + tension);
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * (1 + tension);

    const cp2x = p2.x - ((p3.x - p1.x) / 6) * (1 + tension);
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * (1 + tension);

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
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
  const [hoveredSeries, setHoveredSeries] = useState<"ganhos" | "perdas" | null>(null);

  // Totais do ano
  const totalValorGanho = data.reduce((acc, d) => acc + d.valorGanho, 0);
  const totalQtdGanho = data.reduce((acc, d) => acc + d.qtdGanho, 0);
  const totalValorPerda = data.reduce((acc, d) => acc + d.valorPerda, 0);
  const totalQtdPerda = data.reduce((acc, d) => acc + d.qtdPerda, 0);

  // Dimensões do gráfico com proporções minimalistas
  const width = 960;
  const height = 290;
  const padL = 55;
  const padR = 40;
  const padT = 32;
  const padB = 40;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  // Escala máxima unificada
  const maxValor = Math.max(
    ...data.map((d) => Math.max(d.valorGanho, d.valorPerda)),
    1
  );

  const xCoord = (i: number) =>
    padL + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);

  const yCoord = (val: number) => {
    const norm = maxValor > 0 ? val / maxValor : 0;
    return padT + plotH - norm * plotH;
  };

  // Coordenadas
  const pointsGanho = data.map((d, i) => ({
    x: xCoord(i),
    y: yCoord(d.valorGanho),
    ...d,
  }));

  const pointsPerda = data.map((d, i) => ({
    x: xCoord(i),
    y: yCoord(d.valorPerda),
    ...d,
  }));

  const pathGanho = getSmoothCurvedPath(pointsGanho);
  const pathPerda = getSmoothCurvedPath(pointsPerda);

  // Áreas sob as curvas
  const areaGanho = pointsGanho.length > 0
    ? `${pathGanho} L ${pointsGanho[pointsGanho.length - 1].x.toFixed(2)} ${padT + plotH} L ${pointsGanho[0].x.toFixed(2)} ${padT + plotH} Z`
    : "";

  const areaPerda = pointsPerda.length > 0
    ? `${pathPerda} L ${pointsPerda[pointsPerda.length - 1].x.toFixed(2)} ${padT + plotH} L ${pointsPerda[0].x.toFixed(2)} ${padT + plotH} Z`
    : "";

  const hoveredItem = hoveredIndex !== null ? data[hoveredIndex] : null;

  // Posição horizontal do tooltip flutuante
  const tooltipX = hoveredIndex !== null && pointsGanho[hoveredIndex]
    ? Math.max(180, Math.min(width - 180, pointsGanho[hoveredIndex].x))
    : width / 2;

  const colorGanho = "#10b981"; // Esmeralda minimalista
  const colorPerda = "#ef4444"; // Vermelho minimalista

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--voux-card-border)]/60 bg-[var(--voux-card-from)] p-5 md:p-6 shadow-sm relative overflow-hidden",
        className
      )}
    >
      {/* Header Editorial Minimalista */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
        <div>
          <p
            className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--voux-text-muted)] font-mono"
          >
            HISTÓRICO MENSAL · RESULTADOS CONSOLIDADOS
          </p>
          <h2
            className="text-[19px] md:text-[21px] font-bold tracking-tight text-[var(--voux-text-heading)] mt-0.5"
            style={{ fontFamily: "var(--voux-font-display)" }}
          >
            Desfechos de Vendas em {ano}
          </h2>
          <p className="text-xs text-[var(--voux-text-muted)] mt-0.5 font-sans">
            Comparativo mensal de pedidos aprovados (ganhos) vs negócios perdidos.
          </p>
        </div>

        {/* Legenda Interativa com Destaque no Hover */}
        <div className="flex items-center gap-3 text-xs font-sans">
          <div
            className={cn(
              "flex items-center gap-2 px-2.5 py-1 rounded-xl cursor-pointer transition-all border",
              hoveredSeries === "ganhos"
                ? "bg-emerald-500/15 border-emerald-500/40 shadow-sm"
                : "border-transparent hover:bg-[var(--voux-card-border)]/40"
            )}
            onMouseEnter={() => setHoveredSeries("ganhos")}
            onMouseLeave={() => setHoveredSeries(null)}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 shrink-0" />
            <span className="text-[var(--voux-text-primary)] font-medium">
              Ganhos: <strong className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatBRL(totalValorGanho)}</strong> ({totalQtdGanho} ped)
            </span>
          </div>

          <div
            className={cn(
              "flex items-center gap-2 px-2.5 py-1 rounded-xl cursor-pointer transition-all border",
              hoveredSeries === "perdas"
                ? "bg-red-500/15 border-red-500/40 shadow-sm"
                : "border-transparent hover:bg-[var(--voux-card-border)]/40"
            )}
            onMouseEnter={() => setHoveredSeries("perdas")}
            onMouseLeave={() => setHoveredSeries(null)}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-red-600 shrink-0" />
            <span className="text-[var(--voux-text-primary)] font-medium">
              Perdas: <strong className="font-mono font-bold text-red-600 dark:text-red-400">{formatBRL(totalValorPerda)}</strong> ({totalQtdPerda} neg)
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-[290px] w-full rounded-xl bg-[var(--voux-skeleton)]" />
      ) : (
        <div className="relative">
          {/* Canvas SVG Minimalista com Curvas Arredondadas e Legendas Permanentes em cima dos Pontos */}
          <div className="w-full">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-[290px] overflow-visible"
              preserveAspectRatio="none"
              shapeRendering="geometricPrecision"
              textRendering="geometricPrecision"
            >
              <defs>
                {/* Gradiente Área Ganhos */}
                <linearGradient id={`${uid}-grad-ganho`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colorGanho} stopOpacity="0.14" />
                  <stop offset="100%" stopColor={colorGanho} stopOpacity="0.0" />
                </linearGradient>

                {/* Gradiente Área Perdas */}
                <linearGradient id={`${uid}-grad-perda`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colorPerda} stopOpacity="0.12" />
                  <stop offset="100%" stopColor={colorPerda} stopOpacity="0.0" />
                </linearGradient>

                {/* Laser Vertical */}
                <linearGradient id={`${uid}-laser`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.0" />
                  <stop offset="50%" stopColor="currentColor" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Área e Curva Arredondada de Ganhos */}
              {areaGanho && (
                <path
                  d={areaGanho}
                  fill={`url(#${uid}-grad-ganho)`}
                  opacity={hoveredSeries === "perdas" ? 0.2 : 1}
                  className="transition-opacity duration-200"
                />
              )}
              {pathGanho && (
                <path
                  d={pathGanho}
                  fill="none"
                  stroke={colorGanho}
                  strokeWidth={hoveredSeries === "ganhos" ? "2.6" : "2"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={hoveredSeries === "perdas" ? 0.25 : 1}
                  className="transition-all duration-200"
                />
              )}

              {/* Área e Curva Arredondada de Perdas */}
              {areaPerda && (
                <path
                  d={areaPerda}
                  fill={`url(#${uid}-grad-perda)`}
                  opacity={hoveredSeries === "ganhos" ? 0.2 : 1}
                  className="transition-opacity duration-200"
                />
              )}
              {pathPerda && (
                <path
                  d={pathPerda}
                  fill="none"
                  stroke={colorPerda}
                  strokeWidth={hoveredSeries === "perdas" ? "2.6" : "2"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={hoveredSeries === "ganhos" ? 0.25 : 1}
                  className="transition-all duration-200"
                />
              )}

              {/* Régua Laser Vertical de Foco no Hover */}
              {hoveredIndex !== null && pointsGanho[hoveredIndex] && (
                <line
                  x1={pointsGanho[hoveredIndex].x}
                  y1={padT - 10}
                  x2={pointsGanho[hoveredIndex].x}
                  y2={padT + plotH + 10}
                  stroke={`url(#${uid}-laser)`}
                  className="text-[var(--voux-text-primary)]"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              )}

              {/* Pontos Minimalistas e Legendas Permanentes da Linha Ganhos */}
              {pointsGanho.map((p, i) => {
                const isHovered = hoveredIndex === i;
                const hasValue = p.valorGanho > 0;
                const label = formatCompactValue(p.valorGanho);

                return (
                  <g
                    key={`pt-g-${i}`}
                    opacity={hoveredSeries === "perdas" ? 0.25 : 1}
                    className="transition-opacity duration-200"
                  >
                    {isHovered && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="9"
                        fill={colorGanho}
                        fillOpacity="0.2"
                      />
                    )}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 4.5 : hasValue ? 2.75 : 1.5}
                      fill={hasValue ? colorGanho : "var(--voux-card-border)"}
                      stroke="#ffffff"
                      strokeWidth={hasValue ? 1.2 : 0.8}
                      className="transition-all duration-150"
                    />

                    {/* Legenda Visível Permanente em cima da bolinha de Ganhos */}
                    {hasValue && (
                      <text
                        x={p.x}
                        y={p.y - 7}
                        textAnchor="middle"
                        fontSize="9.5"
                        fontWeight="600"
                        fill={colorGanho}
                        className="dark:fill-emerald-400 select-none pointer-events-none"
                        fontFamily="var(--voux-font-mono)"
                      >
                        {label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Pontos Minimalistas e Legendas Permanentes da Linha Perdas */}
              {pointsPerda.map((p, i) => {
                const isHovered = hoveredIndex === i;
                const hasValue = p.valorPerda > 0;
                const label = formatCompactValue(p.valorPerda);

                return (
                  <g
                    key={`pt-p-${i}`}
                    opacity={hoveredSeries === "ganhos" ? 0.25 : 1}
                    className="transition-opacity duration-200"
                  >
                    {isHovered && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="9"
                        fill={colorPerda}
                        fillOpacity="0.2"
                      />
                    )}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 4.5 : hasValue ? 2.75 : 1.5}
                      fill={hasValue ? colorPerda : "var(--voux-card-border)"}
                      stroke="#ffffff"
                      strokeWidth={hasValue ? 1.2 : 0.8}
                      className="transition-all duration-150"
                    />

                    {/* Legenda Visível Permanente em cima da bolinha de Perdas */}
                    {hasValue && (
                      <text
                        x={p.x}
                        y={p.y - 7}
                        textAnchor="middle"
                        fontSize="9.5"
                        fontWeight="600"
                        fill={colorPerda}
                        className="dark:fill-red-400 select-none pointer-events-none"
                        fontFamily="var(--voux-font-mono)"
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
                    y={height - 10}
                    textAnchor="middle"
                    className={cn(
                      "text-[10.5px] font-sans transition-all",
                      isHovered
                        ? "fill-[var(--voux-text-primary)] font-bold"
                        : "fill-[var(--voux-text-muted)] font-medium"
                    )}
                  >
                    {d.mesNome}
                  </text>
                );
              })}

              {/* Eixo Y Esquerdo: Escala Numérica Minimalista */}
              <text
                x={padL - 10}
                y={padT + 4}
                textAnchor="end"
                className="text-[9.5px] font-mono font-semibold fill-[var(--voux-text-muted)]"
              >
                {formatYAxis(maxValor)}
              </text>
              <text
                x={padL - 10}
                y={padT + plotH * 0.5}
                textAnchor="end"
                className="text-[9.5px] font-mono fill-[var(--voux-text-muted)] opacity-60"
              >
                {formatYAxis(maxValor / 2)}
              </text>
              <text
                x={padL - 10}
                y={padT + plotH}
                textAnchor="end"
                className="text-[9.5px] font-mono fill-[var(--voux-text-muted)]"
              >
                R$ 0
              </text>

              {/* Zonas de Detecção de Hover em cada Mês */}
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

          {/* Caixinha Tooltip Flutuante em Vidro Fosco Real */}
          {hoveredItem && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-2xl p-4 md:p-5 flex items-center gap-6 pointer-events-none z-30 animate-in fade-in zoom-in-95 duration-150 border border-[var(--voux-card-border)]/80 bg-[var(--voux-card-from)]/80 dark:bg-[#121c24]/80 backdrop-blur-xl backdrop-saturate-150 shadow-2xl"
              style={{ left: `${(tooltipX / width) * 100}%` }}
            >
              {/* MÊS */}
              <div className="border-r border-[var(--voux-card-border)] pr-5">
                <p className="text-[10px] uppercase font-bold text-[var(--voux-text-muted)] font-mono tracking-wider">
                  MÊS
                </p>
                <p className="text-[18px] font-bold text-[var(--voux-text-primary)] font-mono tracking-tight">
                  {hoveredItem.mesNome} / {ano}
                </p>
              </div>

              {/* Ganhos */}
              <div className="space-y-0.5 min-w-[140px]">
                <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                  <span>Ganhos:</span>
                </div>
                <p className="font-mono font-bold text-[16px] text-[var(--voux-text-primary)] tracking-tight">
                  {formatBRL(hoveredItem.valorGanho)}
                </p>
                <p className="text-[11px] text-[var(--voux-text-muted)] font-mono">
                  {hoveredItem.qtdGanho} pedido{hoveredItem.qtdGanho !== 1 ? "s" : ""} aprovado{hoveredItem.qtdGanho !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Perdas */}
              <div className="space-y-0.5 min-w-[140px]">
                <div className="flex items-center gap-2 font-semibold text-red-600 dark:text-red-400 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
                  <span>Perdas:</span>
                </div>
                <p className="font-mono font-bold text-[16px] text-[var(--voux-text-primary)] tracking-tight">
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
