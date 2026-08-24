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

/** Formata valor compacto e elegante acima dos pontos */
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

/** Cubic bezier smooth path seguindo o padrão institucional VOUX */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  }
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
  const [hoveredSeries, setHoveredSeries] = useState<"ganhos" | "perdas" | null>(null);

  // Totais do ano
  const totalValorGanho = data.reduce((acc, d) => acc + d.valorGanho, 0);
  const totalQtdGanho = data.reduce((acc, d) => acc + d.qtdGanho, 0);
  const totalValorPerda = data.reduce((acc, d) => acc + d.valorPerda, 0);
  const totalQtdPerda = data.reduce((acc, d) => acc + d.qtdPerda, 0);

  // Dimensões do gráfico VOUX
  const width = 960;
  const height = 310;
  const padL = 35;
  const padR = 35;
  const padT = 28;
  const padB = 42;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  // Bandas separadas independentes (Ganhos na superior, Perdas na inferior)
  const bandGap = 28;
  const bandH = (plotH - bandGap) / 2;

  // Escalas independentes
  const maxGanho = Math.max(...data.map((d) => d.valorGanho), 1);
  const maxPerda = Math.max(...data.map((d) => d.valorPerda), 1);

  const xCoord = (i: number) =>
    padL + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);

  // Banda A: Ganhos (Parte Superior)
  const bandABottom = padT + bandH;
  const yCoordA = (val: number) => {
    const norm = maxGanho > 0 ? val / maxGanho : 0;
    return bandABottom - norm * (bandH - 18);
  };

  // Banda B: Perdas (Parte Inferior)
  const bandBTop = padT + bandH + bandGap;
  const bandBBottom = bandBTop + bandH;
  const yCoordB = (val: number) => {
    const norm = maxPerda > 0 ? val / maxPerda : 0;
    return bandBBottom - norm * (bandH - 18);
  };

  // Coordenadas dos pontos
  const pointsGanho = data.map((d, i) => ({
    x: xCoord(i),
    y: yCoordA(d.valorGanho),
    ...d,
  }));

  const pointsPerda = data.map((d, i) => ({
    x: xCoord(i),
    y: yCoordB(d.valorPerda),
    ...d,
  }));

  const pathGanho = smoothPath(pointsGanho);
  const pathPerda = smoothPath(pointsPerda);

  // Áreas preenchidas sob as curvas
  const areaGanho = pointsGanho.length > 0
    ? `${pathGanho} L ${pointsGanho[pointsGanho.length - 1].x.toFixed(2)} ${bandABottom} L ${pointsGanho[0].x.toFixed(2)} ${bandABottom} Z`
    : "";

  const areaPerda = pointsPerda.length > 0
    ? `${pathPerda} L ${pointsPerda[pointsPerda.length - 1].x.toFixed(2)} ${bandBBottom} L ${pointsPerda[0].x.toFixed(2)} ${bandBBottom} Z`
    : "";

  const hoveredItem = hoveredIndex !== null ? data[hoveredIndex] : null;

  const colorGanho = "#1b4332"; // Verde Floresta Institucional
  const colorPerda = "#b83a28"; // Terracota VOUX

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-5 md:p-6 shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      {/* Header no Estilo Editorial VOUX */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
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
            Desfechos de Vendas em {ano}
          </h2>
          <p className="text-xs text-[var(--voux-text-muted)] mt-0.5 font-sans">
            Curvas com eixos independentes para pedidos ganhos e negócios perdidos.
          </p>
        </div>

        {/* Legenda Interativa com Hover nas Séries */}
        <div className="flex items-center gap-3 text-xs font-sans">
          <div
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all",
              hoveredSeries === "ganhos"
                ? "bg-emerald-500/15 ring-1 ring-emerald-500/40 shadow-sm"
                : "hover:bg-[var(--voux-card-border)]/40"
            )}
            onMouseEnter={() => setHoveredSeries("ganhos")}
            onMouseLeave={() => setHoveredSeries(null)}
          >
            <span className="h-3 w-3 rounded-full bg-[#1b4332] dark:bg-emerald-400 shrink-0" />
            <span className="text-[var(--voux-text-primary)] font-medium">
              Ganhos: <strong className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatBRL(totalValorGanho)}</strong> ({totalQtdGanho} ped)
            </span>
          </div>

          <div
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all",
              hoveredSeries === "perdas"
                ? "bg-red-500/15 ring-1 ring-red-500/40 shadow-sm"
                : "hover:bg-[var(--voux-card-border)]/40"
            )}
            onMouseEnter={() => setHoveredSeries("perdas")}
            onMouseLeave={() => setHoveredSeries(null)}
          >
            <span className="h-3 w-3 rounded-full bg-[#b83a28] dark:bg-red-500 shrink-0" />
            <span className="text-[var(--voux-text-primary)] font-medium">
              Perdas: <strong className="font-mono font-bold text-red-600 dark:text-red-400">{formatBRL(totalValorPerda)}</strong> ({totalQtdPerda} neg)
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-[300px] w-full rounded-xl bg-[var(--voux-skeleton)]" />
      ) : (
        <div className="relative">
          {/* Canvas SVG do Gráfico Unificado sem pontilhados */}
          <div className="w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-[300px] overflow-visible"
              preserveAspectRatio="none"
              shapeRendering="geometricPrecision"
              textRendering="geometricPrecision"
            >
              <defs>
                {/* Gradiente Área Ganhos */}
                <linearGradient id={`${uid}-grad-ganho`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                </linearGradient>

                {/* Gradiente Área Perdas */}
                <linearGradient id={`${uid}-grad-perda`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.20" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
                </linearGradient>

                {/* Laser de Foco Vertical */}
                <linearGradient id={`${uid}-laser`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.0" />
                  <stop offset="50%" stopColor="currentColor" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Área e Linha 1: Ganhos (Banda Superior) */}
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
                  className="dark:stroke-emerald-400 transition-opacity duration-200"
                  strokeWidth={hoveredSeries === "ganhos" ? "3" : "2.4"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={hoveredSeries === "perdas" ? 0.25 : 1}
                />
              )}

              {/* Área e Linha 2: Perdas (Banda Inferior) */}
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
                  className="dark:stroke-red-400 transition-opacity duration-200"
                  strokeWidth={hoveredSeries === "perdas" ? "3" : "2.4"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={hoveredSeries === "ganhos" ? 0.25 : 1}
                />
              )}

              {/* Régua Laser Vertical de Foco no Hover */}
              {hoveredIndex !== null && pointsGanho[hoveredIndex] && (
                <line
                  x1={pointsGanho[hoveredIndex].x}
                  y1={padT - 10}
                  x2={pointsGanho[hoveredIndex].x}
                  y2={bandBBottom + 10}
                  stroke={`url(#${uid}-laser)`}
                  className="text-[var(--voux-text-primary)]"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
              )}

              {/* Pontos e Valores da Linha Ganhos */}
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
                        r="8.5"
                        fill="#10b981"
                        fillOpacity="0.25"
                      />
                    )}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 5.5 : hasValue ? 3.5 : 2}
                      fill={hasValue ? colorGanho : "var(--voux-card-border)"}
                      className={hasValue ? "dark:fill-emerald-400" : ""}
                      stroke="#ffffff"
                      strokeWidth={hasValue ? 1.5 : 1}
                      className="transition-all duration-150"
                    />

                    {/* Número Direto no Ponto */}
                    {hasValue && (
                      <text
                        x={p.x}
                        y={p.y - 8}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="600"
                        fill="#1b4332"
                        className="dark:fill-emerald-400"
                        fontFamily="var(--voux-font-sans)"
                        letterSpacing="-0.01em"
                      >
                        {label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Pontos e Valores da Linha Perdas */}
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
                        r="8.5"
                        fill="#ef4444"
                        fillOpacity="0.25"
                      />
                    )}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 5.5 : hasValue ? 3.5 : 2}
                      fill={hasValue ? colorPerda : "var(--voux-card-border)"}
                      className={hasValue ? "dark:fill-red-400" : ""}
                      stroke="#ffffff"
                      strokeWidth={hasValue ? 1.5 : 1}
                      className="transition-all duration-150"
                    />

                    {/* Número Direto no Ponto */}
                    {hasValue && (
                      <text
                        x={p.x}
                        y={p.y - 8}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="600"
                        fill="#b83a28"
                        className="dark:fill-red-400"
                        fontFamily="var(--voux-font-sans)"
                        letterSpacing="-0.01em"
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

          {/* Caixinha Tooltip Flutuante em Vidro Fosco Apple (Frosted Glassmorphism Card) */}
          {hoveredItem && (
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[24px] p-4 md:p-5 flex items-center gap-6 pointer-events-none z-30 animate-in fade-in zoom-in-95 duration-150 border border-white/80 dark:border-white/20 shadow-[0_20px_48px_-8px_rgba(0,0,0,0.22),0_0_0_1px_rgba(255,255,255,0.6)] dark:shadow-[0_24px_50px_-8px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.15)]"
              style={{
                background: "rgba(255, 255, 255, 0.78)",
                backdropFilter: "blur(24px) saturate(180%)",
                WebkitBackdropFilter: "blur(24px) saturate(180%)",
              }}
            >
              {/* MÊS */}
              <div className="border-r border-stone-300/70 dark:border-stone-700/70 pr-5">
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
                  <span className="h-2.5 w-2.5 rounded-full bg-[#1b4332] dark:bg-emerald-400" />
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
                <div className="flex items-center gap-2 font-semibold text-[#b83a28] dark:text-red-400 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#b83a28] dark:bg-red-400" />
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
