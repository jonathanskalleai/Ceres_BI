/**
 * VouxDualLine — Dual line chart estilo VOUX.
 * Linhas no MESMO espaço (não divididas), normalizadas independentemente.
 * Curvas suaves, área preenchida, labels pretos, meses rotacionados.
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
const PAD_R = 40
const PAD_T = 36
const PAD_B = 64

/** Convert points to smooth cubic bezier path */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const cpx = (prev.x + curr.x) / 2
    d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`
  }
  return d
}

export function VouxDualLine({
  data,
  height = 360,
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

  // Normalize each series independently to 0-1
  const { normA, normB } = useMemo(() => {
    const valA = data.map(d => d.serieA)
    const valB = data.map(d => d.serieB)
    const minA = Math.min(...valA, 0)
    const maxA = Math.max(...valA)
    const minB = Math.min(...valB, 0)
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

  const yCoord = (norm: number) => PAD_T + plotH - norm * plotH

  // Generate smooth paths
  const pointsA = normA.map((n, i) => ({ x: xCoord(i), y: yCoord(n) }))
  const pointsB = normB.map((n, i) => ({ x: xCoord(i), y: yCoord(n) }))

  const pathA = smoothPath(pointsA)
  const pathB = smoothPath(pointsB)

  // Area: path + close to bottom
  const baseY = yCoord(0)
  const areaA = pathA + ` L ${pointsA[pointsA.length - 1].x} ${baseY} L ${pointsA[0].x} ${baseY} Z`
  const areaB = pathB + ` L ${pointsB[pointsB.length - 1].x} ${baseY} L ${pointsB[0].x} ${baseY} Z`

  if (!data.length) return null

  const showEveryN = data.length > 16 ? 2 : 1

  return (
    <div ref={containerRef} role="img" aria-label="Gráfico de linhas" style={{ height, width: '100%' }}>
      {w > 0 && (
        <svg
          viewBox={`0 0 ${w} ${h}`}
          width={w}
          height={h}
          shapeRendering="geometricPrecision"
          textRendering="geometricPrecision"
        >
          <defs>
            <linearGradient id={`${uid}-fillA`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorA} stopOpacity={0.3} />
              <stop offset="100%" stopColor={colorA} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id={`${uid}-fillB`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorB} stopOpacity={0.25} />
              <stop offset="100%" stopColor={colorB} stopOpacity={0.03} />
            </linearGradient>
          </defs>

          {/* Legend */}
          <circle cx={PAD_L + 4} cy={14} r={5} fill={colorA} />
          <text x={PAD_L + 16} y={19} fontSize={12} fontWeight={600} fill="var(--voux-text-primary, #1a1714)" fontFamily="var(--voux-font-sans)">{labelA}</text>
          <circle cx={PAD_L + 16 + labelA.length * 7.2 + 20} cy={14} r={5} fill={colorB} />
          <text x={PAD_L + 16 + labelA.length * 7.2 + 32} y={19} fontSize={12} fontWeight={600} fill="var(--voux-text-primary, #1a1714)" fontFamily="var(--voux-font-sans)">{labelB}</text>

          {/* Area fills (B behind A for layering) */}
          <path d={areaB} fill={`url(#${uid}-fillB)`} />
          <path d={areaA} fill={`url(#${uid}-fillA)`} />

          {/* Lines */}
          <path d={pathA} fill="none" stroke={colorA} strokeWidth={2} strokeLinecap="round" />
          <path d={pathB} fill="none" stroke={colorB} strokeWidth={2} strokeLinecap="round" />

          {/* Points + value labels for A */}
          {data.map((d, i) => {
            const cx = pointsA[i].x
            const cy = pointsA[i].y
            const showLabel = i % showEveryN === 0 || i === data.length - 1
            return (
              <g key={`a-${i}`}>
                <circle cx={cx} cy={cy} r={3} fill="var(--voux-surface)" stroke={colorA} strokeWidth={1.5} />
                {showLabel && (
                  <text x={cx} y={cy - 10} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--voux-text-primary, #1a1714)" fontFamily="var(--voux-font-mono)">
                    {fmtA(d.serieA)}
                  </text>
                )}
              </g>
            )
          })}

          {/* Points + value labels for B */}
          {data.map((d, i) => {
            const cx = pointsB[i].x
            const cy = pointsB[i].y
            const showLabel = i % showEveryN === 0 || i === data.length - 1
            return (
              <g key={`b-${i}`}>
                <circle cx={cx} cy={cy} r={3} fill="var(--voux-surface)" stroke={colorB} strokeWidth={1.5} />
                {showLabel && (
                  <text x={cx} y={cy + 16} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--voux-text-primary, #1a1714)" fontFamily="var(--voux-font-mono)">
                    {fmtB(d.serieB)}
                  </text>
                )}
              </g>
            )
          })}

          {/* X axis labels — ALL months, rotated */}
          {data.map((d, i) => {
            const cx = xCoord(i)
            return (
              <text
                key={`x-${i}`}
                x={cx}
                y={h - PAD_B + 24}
                textAnchor="end"
                fontSize={10}
                fontWeight={500}
                fill="var(--voux-text-primary, #1a1714)"
                fontFamily="var(--voux-font-mono)"
                transform={`rotate(-50 ${cx} ${h - PAD_B + 24})`}
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
