import React, { useId, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

export interface DesempenhoDonutItem {
  name: string;
  qtd: number;
  valor: number;
  percent?: number;
  color?: string;
}

interface DesempenhoDonutCardProps {
  eyebrow: string;
  title: string;
  items: DesempenhoDonutItem[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

const DEFAULT_COLORS = [
  "#2e7d32", // Emerald / Dark Green
  "#e65100", // Orange
  "#f57c00", // Amber / Warm Yellow
  "#0288d1", // Light Blue
  "#7b1fa2", // Purple
  "#c2185b", // Rose
  "#546e7a", // Slate
  "#8d6e63", // Brown
];

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return ["M", start.x, start.y, "A", r, r, 0, largeArc, 0, end.x, end.y].join(" ");
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export const DesempenhoDonutCard: React.FC<DesempenhoDonutCardProps> = ({
  eyebrow,
  title,
  items,
  loading = false,
  emptyMessage = "Nenhum registro no período.",
  className,
}) => {
  const uid = useId().replace(/:/g, "");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const validItems = items.filter((i) => i.valor > 0 || i.qtd > 0);
  const totalValor = validItems.reduce((acc, i) => acc + i.valor, 0);
  const totalQtd = validItems.reduce((acc, i) => acc + i.qtd, 0);

  const itemsWithColor = validItems.map((item, idx) => ({
    ...item,
    color: item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
    calculatedPercent: totalValor > 0 ? (item.valor / totalValor) * 100 : totalQtd > 0 ? (item.qtd / totalQtd) * 100 : 0,
  }));

  // Gera os arcos SVG
  let cumAngle = 0;
  const arcs = itemsWithColor.map((item) => {
    const angle = item.calculatedPercent > 0 ? (item.calculatedPercent / 100) * 360 : 0;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;
    return { ...item, startAngle, endAngle, angle };
  });

  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = 72;
  const thickness = 28;
  const midRadius = outerRadius - thickness / 2;

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-5 md:p-6 shadow-sm transition-shadow hover:shadow-md flex flex-col justify-between",
        className
      )}
    >
      <div>
        {/* Header no estilo do exemplo */}
        <div className="mb-4">
          <p
            className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--voux-text-muted)]"
            style={{ fontFamily: "var(--voux-font-mono)" }}
          >
            {eyebrow}
          </p>
          <h2
            className="text-[18px] md:text-[20px] font-bold tracking-tight text-[var(--voux-text-heading)] mt-0.5"
            style={{ fontFamily: "var(--voux-font-display)" }}
          >
            {title}
          </h2>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center gap-6 py-4">
            <Skeleton className="h-36 w-36 rounded-full bg-[var(--voux-skeleton)] shrink-0" />
            <div className="space-y-3 flex-1">
              <Skeleton className="h-5 w-full rounded bg-[var(--voux-skeleton)]" />
              <Skeleton className="h-5 w-4/5 rounded bg-[var(--voux-skeleton)]" />
              <Skeleton className="h-5 w-3/5 rounded bg-[var(--voux-skeleton)]" />
            </div>
          </div>
        ) : itemsWithColor.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--voux-text-muted)]">
            {emptyMessage}
          </div>
        ) : (
          /* Visual Layout: Donut on the Left, List on the Right */
          <div className="flex flex-col sm:flex-row items-center sm:items-center justify-between gap-6 py-2">
            {/* SVG Donut */}
            <div className="relative shrink-0 flex items-center justify-center">
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
                {arcs.map((arc, idx) => {
                  if (arc.angle >= 359.99) {
                    return (
                      <circle
                        key={`${uid}-${idx}`}
                        cx={cx}
                        cy={cy}
                        r={midRadius}
                        fill="none"
                        stroke={arc.color}
                        strokeWidth={thickness}
                        opacity={hoveredIndex === null || hoveredIndex === idx ? 1 : 0.4}
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        style={{ cursor: "pointer", transition: "opacity 0.2s" }}
                      />
                    );
                  }

                  const path = describeArc(cx, cy, midRadius, arc.startAngle, arc.endAngle);
                  return (
                    <path
                      key={`${uid}-${idx}`}
                      d={path}
                      fill="none"
                      stroke={arc.color}
                      strokeWidth={thickness}
                      strokeLinecap="butt"
                      opacity={hoveredIndex === null || hoveredIndex === idx ? 1 : 0.4}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      style={{ cursor: "pointer", transition: "opacity 0.2s" }}
                    />
                  );
                })}
              </svg>

              {/* Centro com Valor Total */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span
                  className="text-[9px] font-bold tracking-wider uppercase text-[var(--voux-text-muted)]"
                  style={{ fontFamily: "var(--voux-font-mono)" }}
                >
                  TOTAL
                </span>
                <span className="text-[13px] font-bold font-mono text-[var(--voux-text-primary)]">
                  {totalQtd.toLocaleString("pt-BR")}
                </span>
              </div>
            </div>

            {/* Legenda Lateral no estilo exato da imagem */}
            <div className="flex-1 w-full space-y-2.5">
              {itemsWithColor.map((item, idx) => (
                <div
                  key={`${item.name}-${idx}`}
                  className={cn(
                    "flex items-center justify-between gap-3 text-xs p-1.5 rounded-lg transition-colors cursor-pointer",
                    hoveredIndex === idx ? "bg-[var(--voux-card-border)]/40" : "hover:bg-[var(--voux-card-border)]/20"
                  )}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-medium text-[13px] text-[var(--voux-text-primary)] truncate" title={item.name}>
                      {item.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 font-mono shrink-0 tabular-nums">
                    <span className="text-[12px] text-[var(--voux-text-primary)]">
                      {item.qtd} ({item.calculatedPercent.toFixed(1)}%)
                    </span>
                    <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatBRL(item.valor)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer com Totalizador */}
      {!loading && itemsWithColor.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[var(--voux-card-border)] flex items-center justify-between text-[11px] text-[var(--voux-text-muted)]">
          <span className="font-medium">Total Geral:</span>
          <div className="flex items-center gap-3 font-mono">
            <span><strong>{totalQtd.toLocaleString("pt-BR")}</strong> unidades</span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatBRL(totalValor)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
