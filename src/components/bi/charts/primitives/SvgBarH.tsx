import { useEffect, useRef, useMemo } from "react";
import { VOUX_COLORS, fmtCompact } from "./svgGeometry";

export interface SvgBarHProps {
  width: number;
  data: { label: string; value: number }[];
  color?: string;
  valueFormatter?: (v: number) => string;
  /** Show value label to the right of each bar (default true). Skips zero values. */
  showValues?: boolean;
  max?: number;
  labelW?: number;
  rowH?: number;
  onBarEnter?: (dataIndex: number, x: number, y: number, label: string, value: number) => void;
  onBarLeave?: () => void;
  onBarClick?: (dataIndex: number) => void;
}

/**
 * Horizontal bar chart — VOUX style.
 * Each row: track (full width) + animated gradient bar + mono value label.
 */
export function SvgBarH({
  width,
  data,
  color = VOUX_COLORS.accent,
  valueFormatter = fmtCompact,
  showValues = true,
  max: maxProp,
  labelW: labelWProp = 170,
  rowH = 26,
  onBarEnter,
  onBarLeave,
  onBarClick,
}: SvgBarHProps) {
  const labelW = Math.min(labelWProp, Math.max(110, width * 0.40));
  const isNarrow = width < 400;
  const gap = 8;
  const padTop = 4;
  const valueW = 60;
  const height = data.length * (rowH + gap) + padTop;

  const max = maxProp ?? Math.max(...data.map((d) => d.value), 1);
  const barX = labelW + 12;
  const barMaxW = Math.max(40, width - barX - valueW - 8);

  // Refs for animated rects — one per data row
  const barRefs = useRef<(SVGRectElement | null)[]>([]);
  const valRefs = useRef<(SVGTextElement | null)[]>([]);

  // Unique per-instance ID — must be declared before any early return (Rules of Hooks).
  // Prevents gradient ID collisions when multiple SvgBarH components render simultaneously.
  const instanceId = useRef(Math.random().toString(36).slice(2, 8));
  const gradIds = useMemo(
    () => data.map((_, i) => `svgbarh-${instanceId.current}-${i}`),
    [data],
  );

  useEffect(() => {
    if (width === 0) return;
    const frame = requestAnimationFrame(() => {
      data.forEach((d, i) => {
        const bw = max > 0 ? (d.value / max) * barMaxW : 0;
        const rect = barRefs.current[i];
        const valEl = valRefs.current[i];
        if (rect) {
          rect.style.transition = "width 700ms cubic-bezier(0.22,1,0.36,1)";
          rect.setAttribute("width", String(bw));
        }
        if (valEl) {
          valEl.setAttribute("x", String(barX + bw + 8));
        }
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [width, data, max, barMaxW, barX]);

  if (width === 0) return null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
    >
      <defs>
        {gradIds.map((gid, i) => (
          <linearGradient key={gid} id={gid} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity={0.75} />
            <stop offset="100%" stopColor={color} stopOpacity={1} />
          </linearGradient>
        ))}
      </defs>

      {data.map((d, i) => {
        const y = padTop + i * (rowH + gap);
        const trackY = y + rowH / 2 - 3;

        return (
          <g key={i}>
            {/* label */}
            <text
              x={labelW}
              y={y + rowH / 2 + 4}
              textAnchor="end"
              fontFamily="var(--voux-font-sans)"
              fontSize={12}
              fill={VOUX_COLORS.inkSoft}
            >
              {isNarrow && d.label.length > 12 ? `${d.label.substring(0, 12)}…` : d.label}
            </text>

            {/* track */}
            <rect
              x={barX}
              y={trackY}
              width={barMaxW}
              height={6}
              rx={3}
              fill={VOUX_COLORS.track}
            />

            {/* animated bar — starts at width=0, animated in useEffect */}
            <rect
              ref={(el) => { barRefs.current[i] = el; }}
              x={barX}
              y={trackY}
              width={0}
              height={6}
              rx={3}
              fill={`url(#${gradIds[i]})`}
              onMouseEnter={(e) => onBarEnter?.(i, e.clientX, e.clientY, d.label, d.value)}
              onMouseLeave={onBarLeave}
              onClick={() => onBarClick?.(i)}
              style={{ cursor: onBarClick ? "pointer" : "default" }}
            />

            {/* value */}
            {showValues && d.value !== 0 && (
              <text
                ref={(el) => { valRefs.current[i] = el; }}
                x={barX + 8}
                y={y + rowH / 2 + 4}
                fontFamily="var(--voux-font-mono)"
                fontSize={10}
                fill="var(--voux-text-primary)"
                letterSpacing="0.02em"
              >
                {valueFormatter(d.value)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
