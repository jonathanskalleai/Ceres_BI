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

/** Formata valor compacto e elegante para não poluir o gráfico */
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

/** 
 * Gera caminho SVG com interpolação Monotone Cubic Spline (Fritsch-Carlson)
 * Garante que a curva flua com naturalidade e nunca ultrapasse os picos reais dos dados.
 */
function getMonotoneCubicSpline(points: { x: number; y: number }[]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M ${points[0].x} ${points[0].y}`;
  if (n === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  const d: number[] = new Array(n - 1);
  const m: number[] = new Array(n);

  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    d[i] = dx !== 0 ? dy / dx : 0;
  }

  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) {
      m[i] = 0;
    } else {
      m[i] = (d[i - 1] + d[i]) / 2;
    }
  }

  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(d[i]) < 1e-6) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i] / d[i];
      const beta = m[i + 1] / d[i];
      const s = alpha * alpha + beta * beta;
      if (s > 9) {
        const tau = 3 / Math.sqrt(s);
        m[i] = tau * alpha * d[i];
        m[i + 1] = tau * beta * d[i];
      }
    }
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = p1.x - p0.x;
    const cp1x = p0.x + dx / 3;
    const cp1y = p0.y + (m[i] * dx) / 3;
    const cp2x = p1.x - dx / 3;
    const cp2y = p1.y - (m[i + 1] * dx) / 3;
    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }
  return path;
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
  const width = 920;
  const height = 280;
  const padL = 35;
  const padR = 45;
  const padT = 35;
  const padB = 40;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  // Escalas e normalizações independentes
  const maxGanho = Math.max(...data.map((d) => d.valorGanho), 1);
  const maxPerda = Math.max(...data.map((d) => d.valorPerda), 1);

  const xCoord = (i: number) =>
    padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);

  // Coordenadas das curvas (Ganhos na faixa superior e Perdas na faixa inferior)
  const pointsGanho = data.map((d, i) => {
    const norm = d.valorGanho / maxGanho;
    const y = padT + plotH * 0.55 - norm * (plotH * 0.45);
    return { x: xCoord(i), y, ...d };
  });

  const pointsPerda = data.map((d, i) => {
    const norm = d.valorPerda / maxPerda;
    const y = padT + plotH - norm * (plotH * 0.45);
    return { x: xCoord(i), y, ...d };
  });

  const pathGanho = getMonotoneCubicSpline(pointsGanho);
  const pathPerda = getMonotoneCubicSpline(pointsPerda);

  // Áreas gradientes preenchidas sob as curvas
  const areaGanho = pointsGanho.length > 0
    ? `${pathGanho} L ${pointsGanho[pointsGanho.length - 1].x} ${padT + plotH} L ${pointsGanho[0].x} ${padT + plotH} Z`
    : "";

  const areaPerda = pointsPerda.length > 0
    ? `${pathPerda} L ${pointsPerda[pointsPerda.length - 1].x} ${padT + plotH} L ${pointsPerda[0].x} ${padT + plotH} Z`
    : "";

  const colorGanho = "#1b4332"; // Verde Floresta Institucional
  const colorPerda = "#b83a28"; // Terracota VOUX

  const hoveredItem = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-5 md:p-6 shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      {/* Header no Estilo Editorial VOUX */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
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
            Desfechos de Vendas em <span className="italic font-normal text-red-600 dark:text-red-400">{ano}</span>
          </h2>
          <p className="text-xs text-[var(--voux-text-muted)] mt-0.5 font-sans">
            Curvas comparativas de pedidos aprovados e negócios perdidos com escalas dinâmicas.
          </p>
        </div>

        {/* Legenda com Marcadores Redondos */}
        <div className="flex items-center gap-5 text-xs font-sans">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#1b4332] dark:bg-emerald-500 shrink-0" />
            <span className="text-[var(--voux-text-primary)] font-medium">
              Ganhos: <strong className="font-mono font-bold">{formatBRL(totalValorGanho)}</strong> ({totalQtdGanho} ped)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#b83a28] dark:bg-red-500 shrink-0" />
            <span className="text-[var(--voux-text-primary)] font-medium">
              Perdas: <strong className="font-mono font-bold">{formatBRL(totalValorPerda)}</strong> ({totalQtdPerda} neg)
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-[260px] w-full rounded-xl bg-[var(--voux-skeleton)]" />
      ) : (
        <div className="relative">
          {/* Canvas SVG do Gráfico com Gradientes e Monotone Splines */}
          <div className="w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-[260px] overflow-visible"
              preserveAspectRatio="none"
              shapeRendering="geometricPrecision"
              textRendering="geometricPrecision"
            >
              <defs>
                {/* Gradiente de Luz para Área de Ganhos */}
                <linearGradient id={`${uid}-gradient-ganho`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.16" />
                  <stop offset="60%" stopColor="#10b981" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
                </linearGradient>

                {/* Gradiente de Luz para Área de Perdas */}
                <linearGradient id={`${uid}-gradient-perda`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.12" />
                  <stop offset="60%" stopColor="#ef4444" stopOpacity="0.03" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.00" />
                </linearGradient>

                {/* Gradiente Laser para Linha Vertical de Foco */}
                <linearGradient id={`${uid}-laser`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.1" />
                  <stop offset="50%" stopColor="currentColor" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.1" />
                </linearGradient>
              </defs>

              {/* Linhas de Grade Horizontais Ultra-Discretas */}
              <line
                x1={padL}
                y1={padT + plotH * 0.25}
                x2={padL + plotW}
                y2={padT + plotH * 0.25}
                stroke="currentColor"
                className="text-[var(--voux-text-muted)]"
                strokeOpacity="0.07"
                strokeDasharray="3 4"
              />
              <line
                x1={padL}
                y1={padT + plotH * 0.55}
                x2={padL + plotW}
                y2={padT + plotH * 0.55}
                stroke="currentColor"
                className="text-[var(--voux-text-muted)]"
                strokeOpacity="0.07"
                strokeDasharray="3 4"
              />
              <line
                x1={padL}
                y1={padT + plotH * 0.85}
                x2={padL + plotW}
                y2={padT + plotH * 0.85}
                stroke="currentColor"
                className="text-[var(--voux-text-muted)]"
                strokeOpacity="0.07"
                strokeDasharray="3 4"
              />

              {/* Área Gradiente de Ganhos */}
              {areaGanho && <path d={areaGanho} fill={`url(#${uid}-gradient-ganho)`} />}

              {/* Área Gradiente de Perdas */}
              {areaPerda && <path d={areaPerda} fill={`url(#${uid}-gradient-perda)`} />}

              {/* Linha 1: Ganhos (Monotone Spline) */}
              {pathGanho && (
                <path
                  d={pathGanho}
                  fill="none"
                  stroke={colorGanho}
                  className="dark:stroke-emerald-400"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Linha 2: Perdas (Monotone Spline) */}
              {pathPerda && (
                <path
                  d={pathPerda}
                  fill="none"
                  stroke={colorPerda}
                  className="dark:stroke-red-400"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Régua Laser Vertical de Foco no Hover */}
              {hoveredIndex !== null && (
                <line
                  x1={pointsGanho[hoveredIndex]?.x}
                  y1={padT - 10}
                  x2={pointsGanho[hoveredIndex]?.x}
                  y2={padT + plotH + 5}
                  stroke={`url(#${uid}-laser)`}
                  className="text-[var(--voux-text-primary)]"
                  strokeWidth="1.5"
                  strokeDasharray="2 3"
                />
              )}

              {/* Pontos e Rótulos da Linha Ganhos com Efeito Halo */}
              {pointsGanho.map((p, i) => {
                const isHovered = hoveredIndex === i;
                const hasValue = p.valorGanho > 0;
                const label = formatCompactValue(p.valorGanho);

                return (
                  <g key={`pt-g-${i}`}>
                    {/* Halo de Pulso no Hover */}
                    {isHovered && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="9"
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
                    />

                    {/* Rótulo Compacto com Tipografia Limpa */}
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

              {/* Pontos e Rótulos da Linha Perdas com Efeito Halo */}
              {pointsPerda.map((p, i) => {
                const isHovered = hoveredIndex === i;
                const hasValue = p.valorPerda > 0;
                const label = formatCompactValue(p.valorPerda);

                return (
                  <g key={`pt-p-${i}`}>
                    {/* Halo de Pulso no Hover */}
                    {isHovered && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="9"
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
                    />

                    {/* Rótulo Compacto com Tipografia Limpa */}
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
                    y={height - 8}
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
                  >
                    <title>{`${data[i]?.mesNome}/${ano}`}</title>
                  </rect>
                );
              })}
            </svg>
          </div>

          {/* Caixinha Tooltip Flutuante em Vidro Fosco Apple (Glassmorphism) */}
          {hoveredItem && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/80 dark:border-white/20 bg-white/85 dark:bg-[#121c24]/90 backdrop-blur-xl backdrop-saturate-150 p-4 shadow-[0_16px_36px_-6px_rgba(0,0,0,0.18),0_0_0_1px_rgba(255,255,255,0.6)] dark:shadow-[0_20px_40px_-6px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.1)] flex items-center gap-6 pointer-events-none z-30 text-xs animate-in fade-in zoom-in-95 duration-150">
              <div className="border-r border-[var(--voux-card-border)] pr-4">
                <p className="text-[10px] uppercase font-bold text-[var(--voux-text-muted)]">MÊS</p>
                <p className="text-[16px] font-bold text-[var(--voux-text-primary)] font-mono">
                  {hoveredItem.mesNome} / {ano}
                </p>
              </div>

              {/* Ganhos */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-[#1b4332] dark:bg-emerald-400" />
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
                  <span className="h-2 w-2 rounded-full bg-[#b83a28] dark:bg-red-400" />
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
