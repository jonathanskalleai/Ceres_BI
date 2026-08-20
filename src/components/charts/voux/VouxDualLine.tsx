/**
 * VouxDualLine — Dual line chart com eixos independentes (normalizados).
 * Labels permanentes, todos os meses visíveis, legendas grandes.
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

const PAD_L = 16
const PAD_R = 16
const PAD_T = 36
const PAD_B = 72 // extra space for rotated month labels

export function VouxDualLine({
  data,
  height = 380,
  labelA = 'Série A',
  labelB = 'Série B',
  colorA = '#1a8c3a',
  colorB = '#c49000',
  fmtA = (v) => String(v),
  fmtB = (v) => String(v),
}: VouxDualLineProps) {
  const uid = useId().replace(/:/g, '')
  const [containerRef, w] = useElementWidth<HTMLDivElement>()

  const h = height
  const plotW = w - PAD_L - PAD_R
  const plotH = h - PAD_T - PAD_B

  const { normA, normB } = useMemo(() => {
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
    }
  }, [data])

  const xCoord = (i: number) =>
    PAD_L + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW)

  const bandGap = 28
  const bandH = (plotH - bandGap) / 2
  const yCoordA = (norm: number) => PAD_T + bandH - norm * (bandH - 18)
  const yCoordB = (norm: number) => PAD_T + bandH + bandGap + (bandH - 18) - norm * (bandH - 18)

  const pathA = normA.map((n, i) => `${i === 0 ? 'M' : 'L'} ${xCoord(i)} ${yCoordA(n)}`).join(' ')
  const pathB = normB.map((n, i) => `${i === 0 ? 'M' : 'L'} ${xCoord(i)} ${yCoordB(n)}`).join(' ')

  const areaA = pathA + ` L ${xCoord(data.length - 1)} ${yCoordA(0)} L ${xCoord(0)} ${yCoordA(0)} Z`
  const areaB = pathB + ` L ${xCoord(data.length - 1)} ${yCoordB(0)} L ${xCoord(0)} ${yCoordB(0)} Z`

  if (!data.length) return null

  const showEveryN = data.length > 14 ? 2 : 1

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
              <stop offset="0%" stopColor={colorA} stopOpacity={0.18} />
              <stop offset="100%" stopColor={colorA} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id={`${uid}-areaB`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorB} stopOpacity={0.18} />
              <stop offset="100%" stopColor={colorB} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Legend — big, readable */}
          <circle cx={PAD_L + 4} cy={14} r={5} fill={colorA} />
          <text x={PAD_L + 16} y={18} fontSize={13} fontWeight={700} fill="var(--voux-text-primary, #1a1714)" fontFamily="var(--voux-font-sans)">{labelA}</text>
          <circle cx={PAD_L + 16 + labelA.length * 7.5 + 20} cy={14} r={5} fill={colorB} />
          <text x={PAD_L + 16 + labelA.length * 7.5 + 32} y={18} fontSize={13} fontWeight={700} fill="var(--voux-text-primary, #1a1714)" fontFamily="var(--voux-font-sans)">{labelB}</text>

          {/* Separator line between bands */}
          <line x1={PAD_L} x2={w - PAD_R} y1={PAD_T + bandH + bandGap / 2} y2={PAD_T + bandH + bandGap / 2} stroke="var(--voux-chart-grid)" strokeWidth={1} strokeDasharray="4,3" />

          {/* Area fills */}
          <path d={areaA} fill={`url(#${uid}-areaA)`} />
          <path d={areaB} fill={`url(#${uid}-areaB)`} />

          {/* Lines */}
          <path d={pathA} fill="none" stroke={colorA} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          <path d={pathB} fill="none" stroke={colorB} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

          {/* Points + value labels for A */}
          {data.map((d, i) => {
            const cx = xCoord(i)
            const cy = yCoordA(normA[i])
            const showLabel = i % showEveryN === 0 || i === data.length - 1
            return (
              <g key={`a-${i}`}>
                <circle cx={cx} cy={cy} r={3.5} fill="var(--voux-surface)" stroke={colorA} strokeWidth={2} />
                {showLabel && (
                  <text x={cx} y={cy - 10} textAnchor="middle" fontSize={10} fontWeight={700} fill={colorA} fontFamily="var(--voux-font-mono)">
                    {fmtA(d.serieA)}
                  </text>
                )}
              </g>
            )
          })}

          {/* Points + value labels for B */}
          {data.map((d, i) => {
            const cx = xCoord(i)
            const cy = yCoordB(normB[i])
            const showLabel = i % showEveryN === 0 || i === data.length - 1
            return (
              <g key={`b-${i}`}>
                <circle cx={cx} cy={cy} r={3.5} fill="var(--voux-surface)" stroke={colorB} strokeWidth={2} />
                {showLabel && (
                  <text x={cx} y={cy - 10} textAnchor="middle" fontSize={10} fontWeight={700} fill={colorB} fontFamily="var(--voux-font-mono)">
                    {fmtB(d.serieB)}
                  </text>
                )}
              </g>
            )
          })}

          {/* X axis labels — ALL months, rotated -50° for readability */}
          {data.map((d, i) => {
            const cx = xCoord(i)
            return (
              <text
                key={`x-${i}`}
                x={cx}
                y={h - PAD_B + 20}
                textAnchor="end"
                fontSize={10}
                fontWeight={500}
                fill="var(--voux-text-primary, #1a1714)"
                fontFamily="var(--voux-font-mono)"
                transform={`rotate(-50 ${cx} ${h - PAD_B + 20})`}
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
