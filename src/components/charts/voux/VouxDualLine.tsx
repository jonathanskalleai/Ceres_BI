/**
 * VouxDualLine — Dual line chart com eixos independentes (normalizados).
 * Cada série é normalizada 0–1 independentemente para não achatar uma pela outra.
 * SVG puro, sem dependências externas.
 */
import { useId, useMemo } from 'react'
import { useElementWidth } from './useElementWidth'

export interface DualLineItem {
  label: string
  serieA: number
  serieB: number
}

interface VouxDualLineProps {
  data: DualLineItem[]
  height?: number
  labelA?: string
  labelB?: string
  colorA?: string
  colorB?: string
  fmtA?: (v: number) => string
  fmtB?: (v: number) => string
}

const PAD_L = 12
const PAD_R = 12
const PAD_T = 32
const PAD_B = 38

export function VouxDualLine({
  data,
  height = 280,
  labelA = 'Série A',
  labelB = 'Série B',
  colorA = '#4caf7a',
  colorB = '#d4a05a',
  fmtA = (v) => String(v),
  fmtB = (v) => String(v),
}: VouxDualLineProps) {
  const uid = useId().replace(/:/g, '')
  const [containerRef, w] = useElementWidth<HTMLDivElement>()

  const h = height
  const plotW = w - PAD_L - PAD_R
  const plotH = h - PAD_T - PAD_B

  // Normalize each series independently to 0-1
  const { normA, normB, maxA, minA, maxB, minB } = useMemo(() => {
    const valA = data.map(d => d.serieA)
    const valB = data.map(d => d.serieB)
    const minA = Math.min(...valA)
    const maxA = Math.max(...valA)
    const minB = Math.min(...valB)
    const maxB = Math.max(...valB)
    const rangeA = maxA - minA || 1
    const rangeB = maxB - minB || 1
    return {
      normA: valA.map(v => (v - minA) / rangeA),
      normB: valB.map(v => (v - minB) / rangeB),
      minA, maxA, minB, maxB,
    }
  }, [data])

  const xCoord = (i: number) =>
    PAD_L + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW)

  // Serie A uses top half, Serie B uses bottom half (with gap between)
  const bandGap = 20
  const bandH = (plotH - bandGap) / 2
  const yCoordA = (norm: number) => PAD_T + bandH - norm * bandH
  const yCoordB = (norm: number) => PAD_T + bandH + bandGap + bandH - norm * bandH

  const pathA = normA.map((n, i) => `${i === 0 ? 'M' : 'L'} ${xCoord(i)} ${yCoordA(n)}`).join(' ')
  const pathB = normB.map((n, i) => `${i === 0 ? 'M' : 'L'} ${xCoord(i)} ${yCoordB(n)}`).join(' ')

  const areaA = pathA + ` L ${xCoord(data.length - 1)} ${yCoordA(0)} L ${xCoord(0)} ${yCoordA(0)} Z`
  const areaB = pathB + ` L ${xCoord(data.length - 1)} ${yCoordB(0)} L ${xCoord(0)} ${yCoordB(0)} Z`

  if (!data.length) return null

  return (
    <div ref={containerRef} role="img" aria-label="Gráfico de linhas duplo" style={{ height, width: '100%' }}>
      {w > 0 && (
        <svg
          viewBox={`0 0 ${w} ${h}`}
          width={w}
          height={h}
          shapeRendering="geometricPrecision"
          textRendering="geometricPrecision"
        >
          <defs>
            <linearGradient id={`${uid}-areaA`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorA} stopOpacity={0.25} />
              <stop offset="100%" stopColor={colorA} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id={`${uid}-areaB`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorB} stopOpacity={0.25} />
              <stop offset="100%" stopColor={colorB} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Legend */}
          <circle cx={PAD_L} cy={12} r={4} fill={colorA} />
          <text x={PAD_L + 10} y={16} fontSize={11} fontWeight={500} fill="var(--voux-chart-axis)" fontFamily="var(--voux-font-sans)">{labelA}</text>
          <circle cx={PAD_L + 10 + labelA.length * 6.5 + 16} cy={12} r={4} fill={colorB} />
          <text x={PAD_L + 10 + labelA.length * 6.5 + 26} y={16} fontSize={11} fontWeight={500} fill="var(--voux-chart-axis)" fontFamily="var(--voux-font-sans)">{labelB}</text>

          {/* Separator line between bands */}
          <line x1={PAD_L} x2={w - PAD_R} y1={PAD_T + bandH + bandGap / 2} y2={PAD_T + bandH + bandGap / 2} stroke="var(--voux-chart-grid)" strokeWidth={1} />

          {/* Area fills */}
          <path d={areaA} fill={`url(#${uid}-areaA)`} />
          <path d={areaB} fill={`url(#${uid}-areaB)`} />

          {/* Lines */}
          <path d={pathA} fill="none" stroke={colorA} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <path d={pathB} fill="none" stroke={colorB} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          {/* Points + value labels for A */}
          {data.map((d, i) => {
            const cx = xCoord(i)
            const cy = yCoordA(normA[i])
            return (
              <g key={`a-${i}`}>
                <circle cx={cx} cy={cy} r={3} fill="var(--voux-surface)" stroke={colorA} strokeWidth={1.5} />
                {data.length <= 12 && (
                  <text x={cx} y={cy - 10} textAnchor="middle" fontSize={9} fontWeight={600} fill={colorA} fontFamily="var(--voux-font-mono)">{fmtA(d.serieA)}</text>
                )}
              </g>
            )
          })}

          {/* Points + value labels for B */}
          {data.map((d, i) => {
            const cx = xCoord(i)
            const cy = yCoordB(normB[i])
            return (
              <g key={`b-${i}`}>
                <circle cx={cx} cy={cy} r={3} fill="var(--voux-surface)" stroke={colorB} strokeWidth={1.5} />
                {data.length <= 12 && (
                  <text x={cx} y={cy - 10} textAnchor="middle" fontSize={9} fontWeight={600} fill={colorB} fontFamily="var(--voux-font-mono)">{fmtB(d.serieB)}</text>
                )}
              </g>
            )
          })}

          {/* X axis labels */}
          {data.map((d, i) => {
            const cx = xCoord(i)
            // Only show every Nth label if too many points
            const step = data.length > 12 ? Math.ceil(data.length / 8) : 1
            if (i % step !== 0 && i !== data.length - 1) return null
            return (
              <text
                key={`x-${i}`}
                x={cx}
                y={h - 6}
                textAnchor="middle"
                fontSize={9}
                fill="var(--voux-chart-axis)"
                fontFamily="var(--voux-font-mono)"
              >
                {d.label}
              </text>
            )
          })}
        </svg>
      )}
    </div>
  )
}
