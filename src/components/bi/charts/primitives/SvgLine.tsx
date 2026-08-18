import { useRef } from "react";
import { VOUX_COLORS, VOUX_PALETTE, niceTicks, fmtCompact } from "./svgGeometry";

export interface SvgLineSeries {
  name: string;
  color?: string;
  values: (number | null)[];
  dashed?: boolean;
}

export interface SvgLineProps {
  width: number;
  height: number;
  labels: string[];
  series: SvgLineSeries[];
  points?: boolean;
  /** Show values directly on chart points (default true) */
  showValues?: boolean;
  /** Each series uses its own Y scale (spreads lines apart). Hides Y axis. */
  independentAxes?: boolean;
  yFmt?: (v: number) => string;
  onHover?: (labelIndex: number, x: number, y: number) => void;
  onLeave?: () => void;
  hoveredIdx?: number;
}

/**
 * Line chart — VOUX style.
 * Editorial stroke width 1.5, area fill under 1st series, mono axis labels.
 */
export function SvgLine({
  width,
  height,
  labels,
  series,
  points = true,
  showValues = true,
  independentAxes = false,
  yFmt = fmtCompact,
  onHover,
  onLeave,
  hoveredIdx,
}: SvgLineProps) {
  // Unique per-instance ID — must be declared before any early return (Rules of Hooks).
  // Prevents gradient ID collisions when multiple SvgLine components render simultaneously.
  const instanceId = useRef(Math.random().toString(36).slice(2, 8));

  if (width === 0 || series.length === 0) return null;

  const padL = independentAxes ? 36 : 50;
  const padR = 28;
  const padT = 30;
  const padB = 38;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  // Shared axis calculation (used when independentAxes is false)
  const allVals = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  const dataMin = allVals.length > 0 ? Math.min(...allVals) : 0;
  const dataMax = allVals.length > 0 ? Math.max(...allVals) : 1;
  const yMin = Math.min(0, dataMin);
  let yMax = dataMax * 1.12;
  if (yMax === yMin) yMax = yMin + 1;

  const n = labels.length;
  const xPos = (i: number) =>
    n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW;

  // Per-series Y position functions
  const yPosFns: ((v: number, seriesIdx: number) => number)[] = [];
  if (independentAxes && series.length > 1) {
    // Each series gets a vertical band — distributes them across plotH
    const bandH = plotH / series.length;
    const bandPad = bandH * 0.15; // padding within each band
    for (let sIdx = 0; sIdx < series.length; sIdx++) {
      const sVals = series[sIdx].values.filter((v): v is number => v != null);
      const sMin = sVals.length > 0 ? Math.min(0, Math.min(...sVals)) : 0;
      let sMax = sVals.length > 0 ? Math.max(...sVals) * 1.12 : 1;
      if (sMax === sMin) sMax = sMin + 1;
      const bandTop = padT + sIdx * bandH + bandPad;
      const bandBot = padT + (sIdx + 1) * bandH - bandPad;
      const usableH = bandBot - bandTop;
      yPosFns.push((_v: number) => bandBot - ((_v - sMin) / (sMax - sMin)) * usableH);
    }
  } else {
    // Single shared yPos for all series
    const sharedFn = (v: number) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
    for (let i = 0; i < series.length; i++) yPosFns.push(sharedFn);
  }

  const yPos = (v: number, sIdx = 0) => yPosFns[sIdx]?.(v) ?? (padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH);

  const ticks = independentAxes ? [] : niceTicks(yMin, yMax, 4);
  // Stable ID scoped to this component instance
  const areaGradId = `svgline-area-${instanceId.current}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
      onMouseMove={(e) => {
        if (!onHover) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const idx = Math.round(((mouseX - padL) / plotW) * (n - 1));
        const clampedIdx = Math.max(0, Math.min(n - 1, idx));
        onHover(clampedIdx, e.clientX, e.clientY);
      }}
      onMouseLeave={onLeave}
    >
      <defs>
        {series.map((s, sIdx) => (
          <linearGradient key={sIdx} id={`${areaGradId}-${sIdx}`} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={s.color ?? VOUX_PALETTE[sIdx % VOUX_PALETTE.length]}
              stopOpacity={0.35}
            />
            <stop
              offset="100%"
              stopColor={s.color ?? VOUX_PALETTE[sIdx % VOUX_PALETTE.length]}
              stopOpacity={0}
            />
          </linearGradient>
        ))}
      </defs>

      {/* Y gridlines + labels */}
      {ticks.map((tv, ti) => {
        const yy = yPos(tv, 0);
        return (
          <g key={ti}>
            <line
              x1={padL}
              x2={padL + plotW}
              y1={yy}
              y2={yy}
              stroke={VOUX_COLORS.grid}
              strokeWidth={1}
            />
            <text
              x={padL - 8}
              y={yy + 4}
              textAnchor="end"
              fontFamily="var(--voux-font-mono)"
              fontSize={11}
              fill="var(--voux-text-muted)"
              letterSpacing="0.04em"
            >
              {yFmt(tv)}
            </text>
          </g>
        );
      })}

      {/* X labels */}
      {labels.map((lbl, i) => {
        // Thin labels: narrow (<400) skip some; wide shows all up to 18 points
        const step = (width < 400 && n > 6) ? 2 : (n > 18 ? 3 : 1);
        if (step > 1 && i % step !== 0 && i !== n - 1) return null;
        return (
          <text
            key={i}
            x={xPos(i)}
            y={height - padB + 18}
            textAnchor="middle"
            fontFamily="var(--voux-font-mono)"
            fontSize={11}
            fill={VOUX_COLORS.inkMuted}
            letterSpacing="0.08em"
          >
            {lbl}
          </text>
        );
      })}

      {/* Crosshair */}
      {hoveredIdx != null && (
        <line
          x1={xPos(hoveredIdx)}
          x2={xPos(hoveredIdx)}
          y1={padT}
          y2={padT + plotH}
          stroke="var(--voux-grid-line)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}

      {/* Series */}
      {series.map((s, sIdx) => {
        const color = s.color ?? VOUX_PALETTE[sIdx % VOUX_PALETTE.length];
        const validPairs = s.values
          .map((v, i) => ({ v, i }))
          .filter((p): p is { v: number; i: number } => p.v != null);

        if (validPairs.length === 0) return null;

        // Build path segments, handling nulls as breaks
        let pathD = "";
        s.values.forEach((v, i) => {
          if (v == null) return;
          const cmd =
            pathD === "" || s.values[i - 1] == null ? "M" : "L";
          pathD += `${cmd} ${xPos(i)} ${yPos(v, sIdx)} `;
        });

        const firstI = validPairs[0].i;
        const lastI = validPairs[validPairs.length - 1].i;

        // Area fill under each series — uses per-series band bottom in independentAxes mode
        const bandBottom = independentAxes && series.length > 1
          ? padT + ((sIdx + 1) * (plotH / series.length)) - (plotH / series.length * 0.15)
          : padT + plotH;
        const areaD = pathD
          ? pathD + `L ${xPos(lastI)} ${bandBottom} L ${xPos(firstI)} ${bandBottom} Z`
          : null;

        return (
          <g key={sIdx}>
            {areaD && (
              <path d={areaD} fill={`url(#${areaGradId}-${sIdx})`} stroke="none" />
            )}
            <path
              d={pathD}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={s.dashed ? "4 4" : undefined}
            />
            {points &&
              validPairs.map(({ v, i }) => (
                <circle
                  key={i}
                  cx={xPos(i)}
                  cy={yPos(v, sIdx)}
                  r={3}
                  fill={VOUX_COLORS.surface}
                  stroke={color}
                  strokeWidth={1.5}
                />
              ))}
            {/* Value labels on points */}
            {showValues && (() => {
              // Show values on ALL points — offset alternates by series to reduce overlap
              const indicesToShow = new Set(validPairs.map(p => p.i));
              const offsetY = sIdx === 0 ? -12 : 16;
              return validPairs
                .filter(({ v, i }) => v !== 0 && indicesToShow.has(i))
                .map(({ v, i }) => (
                  <text
                    key={`val-${sIdx}-${i}`}
                    x={xPos(i)}
                    y={yPos(v, sIdx) + offsetY}
                    textAnchor="middle"
                    fontFamily="var(--voux-font-mono)"
                    fontSize={12}
                    fontWeight={600}
                    fill="var(--voux-chart-value-label)"
                    opacity={0.95}
                    letterSpacing="0.02em"
                  >
                    {yFmt(v)}
                  </text>
                ));
            })()}
          </g>
        );
      })}
    </svg>
  );
}
