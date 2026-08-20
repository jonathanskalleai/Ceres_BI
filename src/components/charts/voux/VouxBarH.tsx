/**
 * VouxBarH — Barra horizontal pill com gradiente.
 * Adaptado para funcionar bem em light E dark mode.
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
  /** Limitar a N itens exibidos (para cards pequenos) */
  maxItems?: number
}

const ROW_H = 28
const GAP = 6
const PAD_TOP = 4

export function VouxBarH({
  data: rawData,
  color,
  labelW: labelWProp = 130,
  valueFormatter = fmtBRLCompact,
  maxItems,
}: VouxBarHProps) {
  const uid = useId().replace(/:/g, '')
  const [containerRef, w] = useElementWidth<HTMLDivElement>()

  const data = maxItems ? rawData.slice(0, maxItems) : rawData
  const h = data.length * (ROW_H + GAP) + PAD_TOP
  const max = Math.max(...data.map((d) => d.value), 1)

  // Responsive label width: shrink on narrow containers
  const labelW = Math.min(labelWProp, Math.max(80, w * 0.3))
  const barX = labelW + 10
  // Reserve space for the longest value text
  const longestValue = Math.max(...data.map(d => valueFormatter(d.value).length), 4)
  const valueW = Math.max(52, longestValue * 7 + 12)
  const barMaxW = Math.max(30, w - barX - valueW - 8)

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Gráfico de barras horizontais"
      style={{ height: w > 0 ? h : 0, width: '100%' }}
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
                  <stop offset="0%" stopColor={itemColor} stopOpacity={0.75} />
                  <stop offset="100%" stopColor={itemColor} stopOpacity={1} />
                </linearGradient>
              )
            })}
          </defs>

          {data.map((d, i) => {
            const y = PAD_TOP + i * (ROW_H + GAP)
            const bw = Math.max((d.value / max) * barMaxW, d.value > 0 ? 4 : 0)

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
                  {d.label.length > 18 ? d.label.slice(0, 17) + '…' : d.label}
                </text>

                {/* track */}
                <rect
                  x={barX}
                  y={y + ROW_H / 2 - 3}
                  width={barMaxW}
                  height={6}
                  rx={3}
                  fill="var(--voux-chart-grid)"
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
                  fontWeight={500}
                  fill="var(--voux-text-primary, var(--voux-text))"
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
