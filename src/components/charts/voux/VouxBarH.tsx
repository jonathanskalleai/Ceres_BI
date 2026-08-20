/**
 * VouxBarH — porta React de barH() em charts.js
 *
 * Barra horizontal pill (h=6, rx=3) com gradiente linear horizontal
 * (opacity 0.5→1); trilho de fundo; label à esquerda; valor ao fim da barra.
 */
import { useId } from 'react'
import { useElementWidth } from './useElementWidth'
import { fmtBRLCompact } from './format'

export interface BarHItem {
  label: string
  value: number
  color?: string
}

interface VouxBarHProps {
  data: BarHItem[]
  color: string
  labelW?: number
  valueFormatter?: (v: number) => string
}

const ROW_H = 26
const GAP = 8
const VALUE_W = 60
const PAD_TOP = 4

export function VouxBarH({
  data,
  color,
  labelW = 130,
  valueFormatter = fmtBRLCompact,
}: VouxBarHProps) {
  const uid = useId().replace(/:/g, '')
  const [containerRef, w] = useElementWidth<HTMLDivElement>()

  const h = data.length * (ROW_H + GAP) + PAD_TOP
  const max = Math.max(...data.map((d) => d.value), 1)
  const barX = labelW + 12
  const barMaxW = Math.max(40, w - barX - VALUE_W - 8)

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Gráfico de barras horizontais"
      style={{ height: w > 0 ? h : 0 }}
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
            {data.map((d, i) => {
              const itemColor = d.color ?? color
              return (
                <linearGradient
                  key={i}
                  id={`${uid}-bar-${i}`}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="0"
                >
                  <stop offset="0%" stopColor={itemColor} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={itemColor} stopOpacity={1} />
                </linearGradient>
              )
            })}
          </defs>

          {data.map((d, i) => {
            const y = PAD_TOP + i * (ROW_H + GAP)
            const bw = (d.value / max) * barMaxW

            return (
              <g key={i}>
                {/* label */}
                <text
                  x={labelW}
                  y={y + ROW_H / 2 + 4}
                  textAnchor="end"
                  fontFamily="var(--voux-font-sans)"
                  fontSize={12}
                  fill="var(--voux-chart-axis)"
                >
                  {d.label}
                </text>

                {/* track */}
                <rect
                  x={barX}
                  y={y + ROW_H / 2 - 3}
                  width={barMaxW}
                  height={6}
                  rx={3}
                  fill="rgba(214, 207, 193, 0.04)"
                />

                {/* bar */}
                <rect
                  x={barX}
                  y={y + ROW_H / 2 - 3}
                  width={bw}
                  height={6}
                  rx={3}
                  fill={`url(#${uid}-bar-${i})`}
                />

                {/* value */}
                <text
                  x={barX + bw + 8}
                  y={y + ROW_H / 2 + 4}
                  fontFamily="var(--voux-font-mono)"
                  fontSize={11}
                  fill="var(--voux-text)"
                  letterSpacing="0.02em"
                >
                  {valueFormatter(d.value)}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
