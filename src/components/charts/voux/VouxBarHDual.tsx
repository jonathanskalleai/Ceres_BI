/**
 * VouxBarHDual — porta React de barHDual() em charts.js (linha ~587)
 *
 * Duas barras horizontais por linha (A acima, B abaixo), sem trilho.
 * Label à esquerda, valor à direita de cada barra.
 * Data: [{ label, a, b }]
 */
import { useId } from 'react'
import { useElementWidth } from './useElementWidth'

export interface BarHDualItem {
  label: string
  a: number
  b: number
}

interface VouxBarHDualProps {
  data: BarHDualItem[]
  colorA?: string
  colorB?: string
  labelW?: number
  fmtA?: (v: number) => string
  fmtB?: (v: number) => string
}

const ROW_H = 36
const GAP = 12
const VALUE_PAD = 50

function defaultFmt(v: number): string {
  return v.toLocaleString('pt-BR')
}

export function VouxBarHDual({
  data,
  colorA = '#c97565',
  colorB = '#d4a05a',
  labelW = 70,
  fmtA = defaultFmt,
  fmtB = defaultFmt,
}: VouxBarHDualProps) {
  const uid = useId().replace(/:/g, '')
  const [containerRef, w] = useElementWidth<HTMLDivElement>()

  const totalH = data.length * (ROW_H + GAP)
  const max = Math.max(...data.flatMap((d) => [d.a, d.b]), 1)
  const barX = labelW + 12
  const barMaxW = Math.max(40, w - barX - VALUE_PAD)

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Gráfico de barras horizontais duplas"
      style={{ height: w > 0 ? totalH : 0 }}
    >
      {w > 0 && (
        <svg
          viewBox={`0 0 ${w} ${totalH}`}
          width={w}
          height={totalH}
          shapeRendering="geometricPrecision"
          textRendering="geometricPrecision"
        >
          <defs>
            {data.map((_, i) => (
              <linearGradient key={`ga-${i}`} id={`${uid}-a-${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={colorA} stopOpacity={0.55} />
                <stop offset="100%" stopColor={colorA} stopOpacity={0.85} />
              </linearGradient>
            ))}
            {data.map((_, i) => (
              <linearGradient key={`gb-${i}`} id={`${uid}-b-${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={colorB} stopOpacity={0.55} />
                <stop offset="100%" stopColor={colorB} stopOpacity={0.85} />
              </linearGradient>
            ))}
          </defs>

          {data.map((d, i) => {
            const y = i * (ROW_H + GAP)
            const aw = (d.a / max) * barMaxW
            const bw = (d.b / max) * barMaxW

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

                {/* bar A */}
                <rect
                  x={barX}
                  y={y + 2}
                  width={aw}
                  height={13}
                  rx={3}
                  fill={`url(#${uid}-a-${i})`}
                />
                <text
                  x={barX + aw + 6}
                  y={y + 13}
                  fontFamily="var(--voux-font-mono)"
                  fontSize={10}
                  fill="var(--voux-text)"
                  letterSpacing="0.02em"
                >
                  {fmtA(d.a)}
                </text>

                {/* bar B */}
                <rect
                  x={barX}
                  y={y + 19}
                  width={bw}
                  height={13}
                  rx={3}
                  fill={`url(#${uid}-b-${i})`}
                />
                <text
                  x={barX + bw + 6}
                  y={y + 30}
                  fontFamily="var(--voux-font-mono)"
                  fontSize={10}
                  fill="var(--voux-text)"
                  letterSpacing="0.02em"
                >
                  {fmtB(d.b)}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
