/**
 * VouxBarH — Barra horizontal pill, cor sólida.
 * Labels nunca cortam. labelW se ajusta ao texto mais longo.
 */
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
  maxItems?: number
}

const ROW_H = 30
const GAP = 6
const PAD_TOP = 4
const BAR_H = 8

export function VouxBarH({
  data: rawData,
  color,
  labelW: labelWProp,
  valueFormatter = fmtBRLCompact,
  maxItems,
}: VouxBarHProps) {
  const [containerRef, w] = useElementWidth<HTMLDivElement>()

  const data = maxItems ? rawData.slice(0, maxItems) : rawData
  const h = data.length * (ROW_H + GAP) + PAD_TOP
  const max = Math.max(...data.map((d) => d.value), 1)

  // Dynamic labelW: calculate based on longest label text (~6.5px per char at 12px font)
  const longestLabel = Math.max(...data.map(d => d.label.length), 4)
  const calculatedLabelW = Math.min(longestLabel * 6.8 + 12, w * 0.45)
  const labelW = labelWProp ?? Math.max(90, calculatedLabelW)

  const barX = labelW + 10
  const longestValue = Math.max(...data.map(d => valueFormatter(d.value).length), 4)
  const valueW = Math.max(56, longestValue * 7.2 + 12)
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
          {data.map((d, i) => {
            const y = PAD_TOP + i * (ROW_H + GAP)
            const bw = Math.max((d.value / max) * barMaxW, d.value > 0 ? 4 : 0)
            const itemColor = d.color ?? color

            return (
              <g key={i}>
                {/* label — nunca trunca */}
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
                  y={y + ROW_H / 2 - BAR_H / 2}
                  width={barMaxW}
                  height={BAR_H}
                  rx={BAR_H / 2}
                  fill="var(--voux-chart-grid)"
                />

                {/* bar */}
                <rect
                  x={barX}
                  y={y + ROW_H / 2 - BAR_H / 2}
                  width={bw}
                  height={BAR_H}
                  rx={BAR_H / 2}
                  fill={itemColor}
                />

                {/* value */}
                <text
                  x={barX + bw + 8}
                  y={y + ROW_H / 2 + 4}
                  fontFamily="var(--voux-font-mono)"
                  fontSize={11}
                  fontWeight={600}
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
