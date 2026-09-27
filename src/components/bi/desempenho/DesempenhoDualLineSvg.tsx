import type { Dispatch, SetStateAction } from "react";
import type { DesempenhoMensalItem } from "@/types/desempenhoVendas";
import { cn } from "@/lib/utils";

export type DesempenhoLinePoint = DesempenhoMensalItem & { x: number; y: number };

interface Props {
  uid: string;
  data: DesempenhoMensalItem[];
  pointsGanho: DesempenhoLinePoint[];
  pointsPerda: DesempenhoLinePoint[];
  pathGanho: string;
  pathPerda: string;
  areaGanho: string;
  areaPerda: string;
  maxValor: number;
  width: number;
  height: number;
  padL: number;
  padT: number;
  plotW: number;
  plotH: number;
  hoveredIndex: number | null;
  setHoveredIndex: Dispatch<SetStateAction<number | null>>;
  hoveredSeries: "ganhos" | "perdas" | null;
}

function formatCompactValue(val: number): string {
  if (!val || val === 0) return "";
  if (val >= 1_000_000) {
    const num = (val / 1_000_000).toFixed(1).replace(".", ",");
    return `R$ ${num.endsWith(",0") ? num.slice(0, -2) : num}M`;
  }
  if (val >= 1_000) return `R$ ${Math.round(val / 1_000)}k`;
  return `R$ ${Math.round(val)}`;
}

function formatYAxis(val: number): string {
  if (!val || val === 0) return "R$ 0";
  if (val >= 1_000_000) {
    const num = (val / 1_000_000).toFixed(1).replace(".", ",");
    return `R$ ${num.endsWith(",0") ? num.slice(0, -2) : num}M`;
  }
  if (val >= 1_000) return `R$ ${Math.round(val / 1_000)}k`;
  return `R$ ${Math.round(val)}`;
}

export function DesempenhoDualLineSvg({
  uid, data, pointsGanho, pointsPerda, pathGanho, pathPerda, areaGanho, areaPerda,
  maxValor, width, height, padL, padT, plotW, plotH, hoveredIndex, setHoveredIndex,
  hoveredSeries,
}: Props) {
  const ganho = "#10b981";
  const perda = "#ef4444";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[290px] overflow-visible" preserveAspectRatio="none" shapeRendering="geometricPrecision" textRendering="geometricPrecision">
      <defs>
        <linearGradient id={`${uid}-grad-ganho`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ganho} stopOpacity="0.14" /><stop offset="100%" stopColor={ganho} stopOpacity="0.0" /></linearGradient>
        <linearGradient id={`${uid}-grad-perda`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={perda} stopOpacity="0.12" /><stop offset="100%" stopColor={perda} stopOpacity="0.0" /></linearGradient>
        <linearGradient id={`${uid}-laser`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.0" /><stop offset="50%" stopColor="currentColor" stopOpacity="0.4" /><stop offset="100%" stopColor="currentColor" stopOpacity="0.0" /></linearGradient>
      </defs>

      {areaGanho && <path d={areaGanho} fill={`url(#${uid}-grad-ganho)`} opacity={hoveredSeries === "perdas" ? 0.2 : 1} className="transition-opacity duration-200" />}
      {pathGanho && <path d={pathGanho} fill="none" stroke={ganho} strokeWidth={hoveredSeries === "ganhos" ? "2.6" : "2"} strokeLinecap="round" strokeLinejoin="round" opacity={hoveredSeries === "perdas" ? 0.25 : 1} className="transition-all duration-200" />}
      {areaPerda && <path d={areaPerda} fill={`url(#${uid}-grad-perda)`} opacity={hoveredSeries === "ganhos" ? 0.2 : 1} className="transition-opacity duration-200" />}
      {pathPerda && <path d={pathPerda} fill="none" stroke={perda} strokeWidth={hoveredSeries === "perdas" ? "2.6" : "2"} strokeLinecap="round" strokeLinejoin="round" opacity={hoveredSeries === "ganhos" ? 0.25 : 1} className="transition-all duration-200" />}

      {hoveredIndex !== null && pointsGanho[hoveredIndex] && <line x1={pointsGanho[hoveredIndex].x} y1={padT - 10} x2={pointsGanho[hoveredIndex].x} y2={padT + plotH + 10} stroke={`url(#${uid}-laser)`} className="text-[var(--voux-text-primary)]" strokeWidth="1" strokeDasharray="2 2" />}

      {pointsGanho.map((p, i) => {
        const isHovered = hoveredIndex === i;
        const hasValue = p.valorGanho > 0;
        return <g key={`pt-g-${i}`} opacity={hoveredSeries === "perdas" ? 0.25 : 1} className="transition-opacity duration-200">
          {isHovered && <circle cx={p.x} cy={p.y} r="9" fill={ganho} fillOpacity="0.2" />}
          <circle cx={p.x} cy={p.y} r={isHovered ? 4.5 : hasValue ? 2.75 : 1.5} fill={hasValue ? ganho : "var(--voux-card-border)"} stroke="#ffffff" strokeWidth={hasValue ? 1.2 : 0.8} className="transition-all duration-150" />
          {hasValue && <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize="9.5" fontWeight="600" fill={ganho} className="dark:fill-emerald-400 select-none pointer-events-none" fontFamily="var(--voux-font-mono)">{formatCompactValue(p.valorGanho)}</text>}
        </g>;
      })}
      {pointsPerda.map((p, i) => {
        const isHovered = hoveredIndex === i;
        const hasValue = p.valorPerda > 0;
        return <g key={`pt-p-${i}`} opacity={hoveredSeries === "ganhos" ? 0.25 : 1} className="transition-opacity duration-200">
          {isHovered && <circle cx={p.x} cy={p.y} r="9" fill={perda} fillOpacity="0.2" />}
          <circle cx={p.x} cy={p.y} r={isHovered ? 4.5 : hasValue ? 2.75 : 1.5} fill={hasValue ? perda : "var(--voux-card-border)"} stroke="#ffffff" strokeWidth={hasValue ? 1.2 : 0.8} className="transition-all duration-150" />
          {hasValue && <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize="9.5" fontWeight="600" fill={perda} className="dark:fill-red-400 select-none pointer-events-none" fontFamily="var(--voux-font-mono)">{formatCompactValue(p.valorPerda)}</text>}
        </g>;
      })}

      {data.map((d, i) => {
        const x = pointsGanho[i]?.x ?? padL;
        const isHovered = hoveredIndex === i;
        return <text key={`lbl-x-${i}`} x={x} y={height - 10} textAnchor="middle" className={cn("text-[10.5px] font-sans transition-all", isHovered ? "fill-[var(--voux-text-primary)] font-bold" : "fill-[var(--voux-text-muted)] font-medium")}>{d.mesNome}</text>;
      })}
      <text x={padL - 10} y={padT + 4} textAnchor="end" className="text-[9.5px] font-mono font-semibold fill-[var(--voux-text-muted)]">{formatYAxis(maxValor)}</text>
      <text x={padL - 10} y={padT + plotH * 0.5} textAnchor="end" className="text-[9.5px] font-mono fill-[var(--voux-text-muted)] opacity-60">{formatYAxis(maxValor / 2)}</text>
      <text x={padL - 10} y={padT + plotH} textAnchor="end" className="text-[9.5px] font-mono fill-[var(--voux-text-muted)]">R$ 0</text>
      {data.map((_, i) => {
        const x = pointsGanho[i]?.x ?? padL;
        const colWidth = plotW / (data.length || 1);
        return <rect key={`hit-${i}`} x={x - colWidth / 2} y={padT - 20} width={colWidth} height={plotH + 35} fill="transparent" className="cursor-pointer" onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)} />;
      })}
    </svg>
  );
}
