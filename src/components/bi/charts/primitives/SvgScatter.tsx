import { VOUX_COLORS, fmtCompact, niceTicks } from "./svgGeometry";

export interface ScatterPoint {
  label: string;
  x: number;
  y: number;
  /** Destaque visual (ex: outlier de esforco sem retorno). */
  highlight?: boolean;
}

export interface SvgScatterProps {
  width: number;
  height?: number;
  data: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  color?: string;
  highlightColor?: string;
  onPointEnter?: (index: number, clientX: number, clientY: number) => void;
  onPointLeave?: () => void;
}

const PAD = { top: 12, right: 16, bottom: 34, left: 44 };

/**
 * Scatter plot — VOUX style, sem dependencia externa (o projeto nao usa
 * recharts; os graficos sao SVG proprios).
 *
 * Existe porque esforco x retorno so faz sentido em duas dimensoes: em tabela,
 * "615 visitas" e "0 fechamentos" ficam em linhas diferentes e ninguem cruza.
 * No quadrante, o caso salta sozinho.
 */
export function SvgScatter({
  width,
  height = 300,
  data,
  xLabel,
  yLabel,
  color = VOUX_COLORS.accent,
  highlightColor = VOUX_COLORS.danger,
  onPointEnter,
  onPointLeave,
}: SvgScatterProps) {
  if (width === 0 || data.length === 0) return null;

  const plotW = Math.max(40, width - PAD.left - PAD.right);
  const plotH = Math.max(40, height - PAD.top - PAD.bottom);

  const maxX = Math.max(...data.map((d) => d.x), 1);
  const maxY = Math.max(...data.map((d) => d.y), 1);
  const xTicks = niceTicks(0, maxX, 4);
  const yTicks = niceTicks(0, maxY, 4);
  const xMax = xTicks[xTicks.length - 1] || 1;
  const yMax = yTicks[yTicks.length - 1] || 1;

  const px = (v: number) => PAD.left + (v / xMax) * plotW;
  const py = (v: number) => PAD.top + plotH - (v / yMax) * plotH;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      {/* grid horizontal + eixo Y */}
      {yTicks.map((t) => (
        <g key={`y-${t}`}>
          <line x1={PAD.left} y1={py(t)} x2={PAD.left + plotW} y2={py(t)} stroke={VOUX_COLORS.grid} strokeWidth={1} />
          <text
            x={PAD.left - 6}
            y={py(t) + 3}
            textAnchor="end"
            fontFamily="var(--voux-font-mono)"
            fontSize={9}
            fill={VOUX_COLORS.inkFaint}
          >
            {fmtCompact(t)}
          </text>
        </g>
      ))}

      {/* eixo X */}
      {xTicks.map((t) => (
        <text
          key={`x-${t}`}
          x={px(t)}
          y={PAD.top + plotH + 14}
          textAnchor="middle"
          fontFamily="var(--voux-font-mono)"
          fontSize={9}
          fill={VOUX_COLORS.inkFaint}
        >
          {fmtCompact(t)}
        </text>
      ))}

      {/* rotulos dos eixos */}
      <text
        x={PAD.left + plotW / 2}
        y={height - 4}
        textAnchor="middle"
        fontFamily="var(--voux-font-mono)"
        fontSize={9}
        letterSpacing="0.22em"
        fill={VOUX_COLORS.inkMuted}
      >
        {xLabel.toUpperCase()}
      </text>
      <text
        x={10}
        y={PAD.top + plotH / 2}
        textAnchor="middle"
        transform={`rotate(-90 10 ${PAD.top + plotH / 2})`}
        fontFamily="var(--voux-font-mono)"
        fontSize={9}
        letterSpacing="0.22em"
        fill={VOUX_COLORS.inkMuted}
      >
        {yLabel.toUpperCase()}
      </text>

      {/* pontos */}
      {data.map((d, i) => (
        <circle
          key={`${d.label}-${i}`}
          cx={px(d.x)}
          cy={py(d.y)}
          r={d.highlight ? 6 : 4.5}
          fill={d.highlight ? highlightColor : color}
          fillOpacity={d.highlight ? 0.9 : 0.62}
          stroke={d.highlight ? highlightColor : color}
          strokeWidth={d.highlight ? 1.4 : 0.8}
          onMouseEnter={(e) => onPointEnter?.(i, e.clientX, e.clientY)}
          onMouseLeave={onPointLeave}
          style={{ cursor: onPointEnter ? "crosshair" : "default" }}
        >
          <title>{d.label}</title>
        </circle>
      ))}
    </svg>
  );
}
