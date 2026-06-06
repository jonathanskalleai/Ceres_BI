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
}: SvgDonutProps) {
  if (width === 0) return null;

  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(cx, cy) - 18;
  const rIn = r - thickness;
  const total = data.reduce((a, d) => a + d.value, 0);

  let a0 = -Math.PI / 2;
  const segments = data.map((d, i) => {
    const frac = total > 0 ? d.value / total : 0;
    const a1 = a0 + frac * Math.PI * 2;
    const path = arcPath(cx, cy, r, rIn, a0, a1);
    const color = d.color ?? VOUX_PALETTE[i % VOUX_PALETTE.length];
    a0 = a1;
    return { path, color, label: d.label, value: d.value };
  });

  return (
    <>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        aria-hidden="true"
      >
        {segments.map((seg, i) => (
          <path
            key={i}
            d={seg.path}
            fill={seg.color}
            opacity={0.92}
          />
        ))}

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

      {/* HTML legend below the donut */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 14px",
          marginTop: 8,
          justifyContent: "center",
        }}
      >
        {segments.map((seg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--voux-font-mono)",
              fontSize: 10,
              color: VOUX_COLORS.inkSoft,
              letterSpacing: "0.04em",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: seg.color,
                opacity: 0.92,
                flexShrink: 0,
              }}
            />
            <span>{seg.label}</span>
            <span style={{ color: VOUX_COLORS.ink, marginLeft: 2 }}>
              {fmt(seg.value)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
