import React, { useId, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface DesempenhoDonutItem {
  name: string;
  qtd: number;
  valor: number;
  ticketMedio?: number;
  percent?: number;
  color?: string;
}

interface DesempenhoDonutCardProps {
  eyebrow: string;
  title: string;
  items: DesempenhoDonutItem[];
  loading?: boolean;
  emptyMessage?: string;
  selectedItemName?: string | null;
  onItemClick?: (item: DesempenhoDonutItem) => void;
  className?: string;
}

const PALETTE = [
  "#2d6a4f", // Verde Floresta VOUX
  "#b83a28", // Terracota VOUX
  "#c49000", // Mostarda / Ouro VOUX
  "#20639b", // Azul Petróleo
  "#6c5b7b", // Roxo suave
  "#d97724", // Laranja queimado
  "#4a5568", // Grafite
  "#008080", // Teal
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
  selectedItemName,
  onItemClick,
  className,
}) => {
  const uid = useId().replace(/:/g, "");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const validItems = items.filter((i) => i.valor > 0 || i.qtd > 0);
  const totalValor = validItems.reduce((acc, i) => acc + i.valor, 0);
  const totalQtd = validItems.reduce((acc, i) => acc + i.qtd, 0);

  const itemsWithColor = validItems.map((item, idx) => {
    const calcPercent = totalValor > 0 ? (item.valor / totalValor) * 100 : 0;
    const calcTicket = item.ticketMedio ?? (item.qtd > 0 ? item.valor / item.qtd : 0);

    return {
      ...item,
      color: item.color || PALETTE[idx % PALETTE.length],
      calculatedPercent: calcPercent,
      ticketMedio: calcTicket,
    };
  });

  // Arcos SVG
  let cumAngle = 0;
  const arcs = itemsWithColor.map((item) => {
    const angle = item.calculatedPercent > 0 ? (item.calculatedPercent / 100) * 360 : 0;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;
    return { ...item, startAngle, endAngle, angle };
  });

  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = 80;
  const thickness = 28;
  const midRadius = outerRadius - thickness / 2;

  const hoveredItem = hoveredIndex !== null ? itemsWithColor[hoveredIndex] : null;
  const hasSelection = Boolean(
    selectedItemName && itemsWithColor.some((i) => i.name.toLowerCase() === selectedItemName.toLowerCase())
  );

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-5 md:p-6 shadow-sm transition-shadow hover:shadow-md flex flex-col justify-between relative",
        className
      )}
    >
      <div>
        {/* Header no estilo do exemplo */}
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
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

          {onItemClick && (
            <span className="text-[10px] text-[var(--voux-text-muted)] font-sans hidden sm:inline-block">
              Clique para filtrar
            </span>
          )}
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-2">
            {/* SVG Donut */}
            <div className="relative shrink-0 flex items-center justify-center">
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
                {arcs.map((arc, idx) => {
                  const isHovered = hoveredIndex === idx;
                  const isSelected = Boolean(
                    selectedItemName && arc.name.toLowerCase() === selectedItemName.toLowerCase()
                  );
                  const isOtherHovered = (hoveredIndex !== null && !isHovered) || (hasSelection && !isSelected);

                  if (arc.angle >= 359.99) {
                    return (
                      <circle
                        key={`${uid}-${idx}`}
                        cx={cx}
                        cy={cy}
                        r={midRadius}
                        fill="none"
                        stroke={arc.color}
                        strokeWidth={isHovered || isSelected ? thickness + 4 : thickness}
                        opacity={isOtherHovered ? 0.35 : 1}
                        onClick={() => onItemClick && onItemClick(arc)}
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        style={{ cursor: "pointer", transition: "all 0.2s ease" }}
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
                      strokeWidth={isHovered || isSelected ? thickness + 4 : thickness}
                      strokeLinecap="butt"
                      opacity={isOtherHovered ? 0.35 : 1}
                      onClick={() => onItemClick && onItemClick(arc)}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      style={{ cursor: "pointer", transition: "all 0.2s ease" }}
                    />
                  );
                })}
              </svg>

              {/* Centro com Valor Dinâmico (Total ou Item em Foco) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                <span
                  className="text-[9px] font-bold tracking-wider uppercase text-[var(--voux-text-muted)]"
                  style={{ fontFamily: "var(--voux-font-mono)" }}
                >
                  {hoveredItem ? "PARTICIPAÇÃO" : "TOTAL"}
                </span>
                <span className="text-[13px] font-bold font-mono text-[var(--voux-text-primary)]">
                  {hoveredItem
                    ? `${hoveredItem.calculatedPercent.toFixed(1)}%`
                    : `${totalQtd.toLocaleString("pt-BR")} ped`}
                </span>
              </div>
            </div>

            {/* Legenda Lateral Interativa */}
            <div className="flex-1 w-full space-y-2">
              {itemsWithColor.map((item, idx) => {
                const isHovered = hoveredIndex === idx;
                const isSelected = Boolean(
                  selectedItemName && item.name.toLowerCase() === selectedItemName.toLowerCase()
                );

                return (
                  <div
                    key={`${item.name}-${idx}`}
                    onClick={() => onItemClick && onItemClick(item)}
                    className={cn(
                      "flex items-center justify-between gap-3 text-xs p-2.5 rounded-xl transition-all duration-200 cursor-pointer relative",
                      isSelected
                        ? "bg-emerald-500/15 border-l-4 border-l-emerald-600 dark:bg-emerald-950/40 shadow-sm z-20 font-bold scale-[1.01]"
                        : isHovered
                          ? "scale-[1.02] -translate-y-0.5 z-20 bg-[var(--surface-raised)]/95 backdrop-blur-md shadow-[0_8px_24px_-4px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.45)] ring-1 ring-emerald-500/40"
                          : hasSelection
                            ? "opacity-60 hover:opacity-100 hover:bg-[var(--voux-card-border)]/20"
                            : "hover:bg-[var(--voux-card-border)]/20"
                    )}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isSelected ? (
                        <span className="h-4 w-4 rounded-full bg-emerald-600 flex items-center justify-center text-white shrink-0">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      ) : (
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                      )}
                      <span
                        className={cn(
                          "font-medium text-[13px] truncate",
                          isSelected ? "text-emerald-800 dark:text-emerald-300 font-bold" : "text-[var(--voux-text-primary)]"
                        )}
                        title={item.name}
                      >
                        {item.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 font-mono shrink-0 tabular-nums">
                      <span className="text-[12px] text-[var(--voux-text-muted)]">
                        {item.calculatedPercent.toFixed(1)}%
                      </span>
                      <span className="text-[13px] font-bold text-emerald-700 dark:text-emerald-400">
                        {formatBRL(item.valor)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tooltip Flutuante Detalhado com Ticket Médio no Hover */}
      {hoveredItem && (
        <div className="absolute top-4 right-4 rounded-2xl border border-[var(--voux-card-border)] bg-[var(--surface-raised)]/95 backdrop-blur-md p-4 shadow-xl pointer-events-none z-30 text-xs min-w-[240px] space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-2 border-b border-[var(--voux-card-border)] pb-2">
            <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: hoveredItem.color }} />
            <p className="font-bold text-[13px] text-[var(--voux-text-primary)] truncate">{hoveredItem.name}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
            <div>
              <p className="text-[10px] text-[var(--voux-text-muted)] uppercase">Valor Financiado</p>
              <p className="font-bold text-[13px] text-emerald-700 dark:text-emerald-400">{formatBRL(hoveredItem.valor)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--voux-text-muted)] uppercase">Quantidade</p>
              <p className="font-bold text-[13px] text-[var(--voux-text-primary)]">{hoveredItem.qtd} pedidos</p>
            </div>
          </div>

          {hoveredItem.ticketMedio && hoveredItem.ticketMedio > 0 && (
            <div className="border-t border-[var(--voux-card-border)] pt-1.5 font-mono flex items-center justify-between">
              <span className="text-[10px] text-[var(--voux-text-muted)] uppercase">Ticket Médio Financiamento</span>
              <span className="font-bold text-[12px] text-[var(--voux-text-primary)]">{formatBRL(hoveredItem.ticketMedio)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
