import { useEffect, useRef, useMemo } from "react";
import { VOUX_COLORS, fmtCompact } from "./svgGeometry";

export interface SvgBarVProps {
  width: number;
  height: number;
  labels: string[];
  values: number[];
  color?: string;
  /** Cor individual por barra (sobrescreve `color` por indice). */
  barColors?: string[];
  /** @deprecated Use showValues instead */
  dataLabels?: boolean;
  /** Show value above each bar (default true). Skips zero values. */
  showValues?: boolean;
  fmt?: (v: number) => string;
  onBarEnter?: (dataIndex: number, x: number, y: number, label: string, value: number) => void;
  onBarLeave?: () => void;
  onBarClick?: (dataIndex: number) => void;
}

/**
 * Vertical bar chart — VOUX style.
 * Gradient bars (top→bottom opacity 1→0.6), animated from baseline up.
 */
export function SvgBarV({
  width,
  height,
  labels,
  values,
  color = VOUX_COLORS.accent,
  barColors,
  dataLabels = false,
  showValues = true,
  fmt = fmtCompact,
  onBarEnter,
  onBarLeave,
  onBarClick,
}: SvgBarVProps) {
  const padL = 32;
  const padR = 16;
  const padT = 24;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const max = Math.max(...values, 1) * 1.15;
  const bandW = values.length > 0 ? plotW / values.length : plotW;
  const barW = Math.max(16, Math.min(40, bandW * 0.55));
  const isNarrow = width < 400;
  const skipAltLabels = isNarrow && values.length > 8;

  // Merge legacy prop with new prop
  const shouldShowValues = showValues || dataLabels;

  const barRefs = useRef<(SVGRectElement | null)[]>([]);
  const labelRefs = useRef<(SVGTextElement | null)[]>([]);

  // Unique per-instance ID — must be declared before any early return (Rules of Hooks).
  // Prevents gradient ID collisions when multiple SvgBarV components render simultaneously.
  const instanceId = useRef(Math.random().toString(36).slice(2, 8));
  const gradIds = useMemo(
    () => values.map((_, i) => `svgbarv-${instanceId.current}-${i}`),
    [values],
  );

  useEffect(() => {
    if (width === 0) return;
    const frame = requestAnimationFrame(() => {
      values.forEach((v, i) => {
        const bh = (v / max) * plotH;
        const by = padT + plotH - bh;
        const rect = barRefs.current[i];
        if (rect) {
          rect.style.transition =
            "y 700ms cubic-bezier(0.22,1,0.36,1), height 700ms cubic-bezier(0.22,1,0.36,1)";
          rect.setAttribute("y", String(by));
          rect.setAttribute("height", String(bh));
        }
        const lbl = labelRefs.current[i];
        if (lbl && shouldShowValues) {
          lbl.setAttribute("y", String(by - 8));
          lbl.style.opacity = v === 0 ? "0" : "1";
        }
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [width, values, max, plotH, padT, shouldShowValues]);

  if (width === 0) return null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
    >
      <defs>
        {gradIds.map((gid, i) => {
          const c = barColors?.[i] ?? color;
          return (
            <linearGradient key={gid} id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop key={`${gid}-s0`} offset="0%" stopColor={c} stopOpacity={1} />
              <stop key={`${gid}-s1`} offset="100%" stopColor={c} stopOpacity={0.8} />
            </linearGradient>
          );
        })}
      </defs>

      {/* baseline */}
      <line
        x1={padL}
        x2={padL + plotW}
        y1={padT + plotH}
        y2={padT + plotH}
        stroke={VOUX_COLORS.gridStrong}
        strokeWidth={1}
      />

      {values.map((v, i) => {
        const bx = padL + i * bandW + (bandW - barW) / 2;

        return (
          <g key={i}>
            {/* bar — starts at baseline (height=0), animated in useEffect */}
            <rect
              ref={(el) => { barRefs.current[i] = el; }}
              x={bx}
              y={padT + plotH}
              width={barW}
              height={0}
              rx={3}
              fill={`url(#${gradIds[i]})`}
              onMouseEnter={(e) => onBarEnter?.(i, e.clientX, e.clientY, labels[i] ?? "", v)}
              onMouseLeave={onBarLeave}
              onClick={() => onBarClick?.(i)}
              style={{ cursor: onBarClick ? "pointer" : "default" }}
            />

            {/* optional data label */}
            {shouldShowValues && v !== 0 && (
              <text
                ref={(el) => { labelRefs.current[i] = el; }}
                x={bx + barW / 2}
                y={padT + plotH - 8}
                textAnchor="middle"
                fontFamily="var(--voux-font-mono)"
                fontSize={9}
                fill="var(--voux-text-primary)"
                letterSpacing="0.02em"
                style={{ opacity: 0 }}
              >
                {fmt(v)}
              </text>
            )}

            {/* x label */}
            {(!skipAltLabels || i % 2 === 0) && (
              <text
                x={bx + barW / 2}
                y={padT + plotH + 18}
                textAnchor="middle"
                fontFamily="var(--voux-font-mono)"
                fontSize={10}
                fill={VOUX_COLORS.inkMuted}
                letterSpacing="0.08em"
              >
                {labels[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
