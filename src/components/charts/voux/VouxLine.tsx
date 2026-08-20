/**
 * VouxLine — line chart clássico, porta React de line() em charts.js
 *
 * Grade horizontal (5 linhas), eixo Y com labels à esquerda, rótulos de mês
 * retos no eixo X, value label acima de cada ponto, pontos visíveis (r=3),
 * área fill sutil sob a curva primária.
 */
import { useId } from 'react'
import { useElementWidth } from './useElementWidth'
import { fmtCompact } from './format'

export interface LineItem {
  label: string
  value: number
}

interface VouxLineProps {
  data: LineItem[]
  color?: string
  height?: number
  /** Formata os values nos data labels acima dos pontos */
  fmt?: (v: number) => string
  /** Formata os values no eixo Y */
  yFmt?: (v: number) => string
  /** Mostrar área fill sob a linha */
  area?: boolean
  /** Mostrar data labels acima dos pontos */
  dataLabels?: boolean
  /** Aria-label acessível para o gráfico */
  ariaLabel?: string
}

const PAD_L = 44
const PAD_R = 24
const PAD_T = 24
const PAD_B = 32
const GRID_TICKS = 4

const INK_FAINT = 'var(--voux-text-faint)'
const INK_MUTED = 'var(--voux-chart-axis)'
const SURFACE = 'var(--voux-surface)'
const GRID = 'var(--voux-chart-grid)'

export function VouxLine({
  data,
  color = '#c97565',
  height = 280,
  fmt = fmtCompact,
  yFmt = fmtCompact,
  area = true,
  dataLabels = true,
  ariaLabel = 'Gráfico de linha',
}: VouxLineProps) {
  const uid = useId().replace(/:/g, '')
  const [containerRef, w] = useElementWidth<HTMLDivElement>()

  const h = height
  const plotW = w - PAD_L - PAD_R
  const plotH = h - PAD_T - PAD_B

  const values = data.map((d) => d.value)
  const rawMax = Math.max(...values)
  const rawMin = Math.min(0, Math.min(...values))
  const range = rawMax - rawMin || 1
  const max = rawMax + range * GRID_TICKS / (GRID_TICKS * 10) * 1.2
  const min = rawMin

  const xCoord = (i: number) =>
    PAD_L + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW)

  const yCoord = (v: number) =>
    PAD_T + plotH - ((v - min) / (max - min)) * plotH

  const pathD = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xCoord(i)} ${yCoord(d.value)}`)
    .join(' ')

  const areaD =
    pathD +
    ` L ${xCoord(data.length - 1)} ${PAD_T + plotH} L ${xCoord(0)} ${PAD_T + plotH} Z`

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      style={{ height }}
    >
      {w > 0 && (
        <svg
          viewBox={`0 0 ${w} ${h}`}
          width={w}
          height={h}
          shapeRendering="geometricPrecision"
          textRendering="geometricPrecision"
        >
          <defs>
            {area && (
              <linearGradient id={`${uid}-area`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            )}
          </defs>

          {/* horizontal gridlines + Y axis labels */}
          {Array.from({ length: GRID_TICKS + 1 }, (_, i) => {
            const yy = PAD_T + (i / GRID_TICKS) * plotH
            const v = max - (i / GRID_TICKS) * (max - min)
            return (
              <g key={`grid-${i}`}>
                <line
                  x1={PAD_L}
                  x2={PAD_L + plotW}
                  y1={yy}
                  y2={yy}
                  stroke={GRID}
                  strokeWidth={1}
                />
                <text
                  x={PAD_L - 8}
                  y={yy + 4}
                  textAnchor="end"
                  fontFamily="var(--voux-font-mono)"
                  fontSize={10}
                  fill={INK_FAINT}
                  letterSpacing="0.04em"
                >
                  {yFmt(v)}
                </text>
              </g>
            )
          })}

          {/* area fill */}
          {area && <path d={areaD} fill={`url(#${uid}-area)`} stroke="none" />}

          {/* line */}
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* points + data labels + x labels */}
          {data.map((d, i) => {
            const cx = xCoord(i)
            const cy = yCoord(d.value)
            return (
              <g key={`pt-${i}`}>
                {/* data label above point */}
                {dataLabels && (
                  <text
                    x={cx}
                    y={cy - 10}
                    textAnchor="middle"
                    fontFamily="var(--voux-font-mono)"
                    fontSize={10}
                    fill={color}
                    letterSpacing="0.02em"
                  >
                    {fmt(d.value)}
                  </text>
                )}

                {/* point */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={3}
                  fill={SURFACE}
                  stroke={color}
                  strokeWidth={1.5}
                />

                {/* x axis label (month) — reto, sem rotação */}
                <text
                  x={cx}
                  y={h - PAD_B + 18}
                  textAnchor="middle"
                  fontFamily="var(--voux-font-mono)"
                  fontSize={10}
                  fill={INK_MUTED}
                  letterSpacing="0.08em"
                >
                  {d.label}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
