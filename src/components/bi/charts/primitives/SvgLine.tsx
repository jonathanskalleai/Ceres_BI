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
  yFmt?: (v: number) => string;
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
  yFmt = fmtCompact,
}: SvgLineProps) {
  if (width === 0 || series.length === 0) return null;

  const padL = 44;
  const padR = 24;
  const padT = 24;
  const padB = 32;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const allVals = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  const dataMin = allVals.length > 0 ? Math.min(...allVals) : 0;
  const dataMax = allVals.length > 0 ? Math.max(...allVals) : 1;
  const yMin = Math.min(0, dataMin);
  let yMax = dataMax * 1.12;
  if (yMax === yMin) yMax = yMin + 1;

  const n = labels.length;
  const xPos = (i: number) =>
    n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW;
  const yPos = (v: number) =>
    padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const ticks = niceTicks(yMin, yMax, 4);
  // Stable ID scoped to this component dimensions
  const areaGradId = `svgline-area-${width}-${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
    >
      <defs>
        {series[0] && (
          <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={series[0].color ?? VOUX_PALETTE[0]}
              stopOpacity={0.18}
            />
            <stop
              offset="100%"
              stopColor={series[0].color ?? VOUX_PALETTE[0]}
              stopOpacity={0}
            />
          </linearGradient>
        )}
      </defs>

      {/* Y gridlines + labels */}
      {ticks.map((tv, ti) => {
        const yy = yPos(tv);
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
              fontSize={10}
              fill={VOUX_COLORS.inkFaint}
              letterSpacing="0.04em"
            >
              {yFmt(tv)}
            </text>
          </g>
        );
      })}

      {/* X labels */}
      {labels.map((lbl, i) => (
        <text
          key={i}
          x={xPos(i)}
          y={height - padB + 18}
          textAnchor="middle"
          fontFamily="var(--voux-font-mono)"
          fontSize={10}
          fill={VOUX_COLORS.inkMuted}
          letterSpacing="0.08em"
        >
          {lbl}
        </text>
      ))}

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
          pathD += `${cmd} ${xPos(i)} ${yPos(v)} `;
        });

        const firstI = validPairs[0].i;
        const lastI = validPairs[validPairs.length - 1].i;

        // Area fill under first series only
        const areaD =
          sIdx === 0 && pathD
            ? pathD +
              `L ${xPos(lastI)} ${padT + plotH} L ${xPos(firstI)} ${padT + plotH} Z`
            : null;

        return (
          <g key={sIdx}>
            {areaD && (
              <path d={areaD} fill={`url(#${areaGradId})`} stroke="none" />
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
                  cy={yPos(v)}
                  r={3}
                  fill={VOUX_COLORS.surface}
                  stroke={color}
                  strokeWidth={1.5}
                />
              ))}
          </g>
        );
      })}
    </svg>
  );
}
