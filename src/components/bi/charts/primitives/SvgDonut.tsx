import { VOUX_COLORS, VOUX_PALETTE, fmtCompact } from "./svgGeometry";

export interface SvgDonutSegment {
  label: string;
  value: number;
  color?: string;
}

export interface SvgDonutProps {
  width: number;
  height: number;
  data: SvgDonutSegment[];
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  /** Called with a value to produce the legend text */
  fmt?: (v: number) => string;
  onSegmentEnter?: (segIndex: number, x: number, y: number) => void;
  onSegmentLeave?: () => void;
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  rIn: number,
  a0: number,
  a1: number,
): string {
  const x0  = cx + Math.cos(a0) * r;
  const y0  = cy + Math.sin(a0) * r;
  const x1  = cx + Math.cos(a1) * r;
  const y1  = cy + Math.sin(a1) * r;
  const xi1 = cx + Math.cos(a1) * rIn;
  const yi1 = cy + Math.sin(a1) * rIn;
  const xi0 = cx + Math.cos(a0) * rIn;
  const yi0 = cy + Math.sin(a0) * rIn;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${rIn} ${rIn} 0 ${large} 0 ${xi0} ${yi0} Z`;
}

/**
 * Donut chart — VOUX style.
 * Legend rendered as HTML below the SVG (see SvgDonut wrapper component).
 */
export function SvgDonut({
  width,
  height,
  data,
  thickness = 22,
  centerLabel,
  centerValue,
  fmt = fmtCompact,
  onSegmentEnter,
  onSegmentLeave,
}: SvgDonutProps) {
  if (width === 0) return null;

  // Horizontal padding for leader-line labels that extend beyond the donut
  const labelPadX = 80;
  const svgW = width + labelPadX * 2;
  const svgH = height + 20;
  const cx = svgW / 2;
  const cy = svgH / 2;
  const r = Math.min(width / 2, height / 2) - 10;
  const rIn = r - thickness;
  const total = data.reduce((a, d) => a + d.value, 0);

  let a0 = -Math.PI / 2;
  const segments = data.map((d, i) => {
    const frac = total > 0 ? d.value / total : 0;
    const a1 = a0 + frac * Math.PI * 2;
    const path = arcPath(cx, cy, r, rIn, a0, a1);
    const color = d.color ?? VOUX_PALETTE[i % VOUX_PALETTE.length];
    const midAngle = (a0 + a1) / 2;
    a0 = a1;
    return { path, color, label: d.label, value: d.value, midAngle, frac };
  });

  // Leader line geometry
  const leaderR1 = r + 4;   // start just outside arc
  const leaderR2 = r + 18;  // elbow point
  const labelPadH = 8;      // horizontal extension after elbow

  return (
    <>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        width="100%"
        height={svgH}
        aria-hidden="true"
        style={{ overflow: "visible" }}
      >
        {segments.map((seg, i) => (
          <path
            key={i}
            d={seg.path}
            fill={seg.color}
            opacity={0.92}
            onMouseEnter={(e) => onSegmentEnter?.(i, e.clientX, e.clientY)}
            onMouseLeave={onSegmentLeave}
            style={{ cursor: "pointer" }}
          />
        ))}

        {/* Leader lines + external labels */}
        {segments.map((seg, i) => {
          // Skip tiny slices (<3%) to avoid clutter
          if (seg.frac < 0.03) return null;
          const cos = Math.cos(seg.midAngle);
          const sin = Math.sin(seg.midAngle);
          const x1 = cx + cos * leaderR1;
          const y1 = cy + sin * leaderR1;
          const x2 = cx + cos * leaderR2;
          const y2 = cy + sin * leaderR2;
          // Horizontal extension (elbow)
          const direction = cos >= 0 ? 1 : -1;
          const x3 = x2 + direction * labelPadH;
          const y3 = y2;
          const xText = x3 + direction * 4;
          const yText = y3;
          const anchor = cos >= 0 ? "start" : "end";
          const pct = total > 0 ? ((seg.value / total) * 100).toFixed(0) : "0";
          return (
            <g key={`leader-${i}`}>
              <polyline
                points={`${x1},${y1} ${x2},${y2} ${x3},${y3}`}
                fill="none"
                stroke={seg.color}
                strokeWidth={1}
                opacity={0.6}
              />
              <text
                x={xText}
                y={yText + 4}
                textAnchor={anchor}
                fontFamily="var(--voux-font-mono)"
                fontSize={11}
                fill="var(--voux-text-muted)"
                letterSpacing="0.02em"
              >
                {seg.label} ({pct}%)
              </text>
            </g>
          );
        })}

        {centerLabel && (
          <text
            x={cx}
            y={cy - 2}
            textAnchor="middle"
            fontFamily="var(--voux-font-mono)"
            fontSize={10}
            fill={VOUX_COLORS.inkMuted}
            letterSpacing="0.22em"
          >
            {centerLabel}
          </text>
        )}

        {centerValue && (
          <text
            x={cx}
            y={cy + 18}
            textAnchor="middle"
            fontFamily="var(--voux-font-display)"
            fontSize={28}
            fill={VOUX_COLORS.ink}
            letterSpacing="-0.022em"
          >
            {centerValue}
          </text>
        )}
      </svg>
    </>
  );
}
