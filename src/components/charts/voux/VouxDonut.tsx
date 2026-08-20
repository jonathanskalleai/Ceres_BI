/**
 * VouxDonut — SVG-only Donut Chart (sem dependência de Recharts)
 *
 * Gráfico vetorial donut puro com arcos SVG, tooltip CSS nativo,
 * suporte a valores centrais e cores customizáveis.
 */
import { useId, useState } from 'react'

export interface DonutItem {
  label: string
  value: number
  color?: string
}

interface VouxDonutProps {
  data: DonutItem[]
  thickness?: number
  height?: number
  centerLabel?: string
  centerValue?: string
}

const PALETTE = [
  'var(--voux-chart-accent)',
  'var(--voux-info)',
  'var(--voux-success)',
  'var(--voux-warning)',
  'var(--voux-danger)',
  'var(--voux-text-muted)',
  'var(--voux-chart-axis)',
]

/** Gera o path "d" de um arco SVG */
function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return [
    'M', start.x, start.y,
    'A', r, r, 0, largeArc, 0, end.x, end.y,
  ].join(' ')
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

export function VouxDonut({
  data,
  thickness = 20,
  height = 140,
  centerLabel,
  centerValue,
}: VouxDonutProps) {
  const uid = useId().replace(/:/g, '')
  const [hovered, setHovered] = useState<number | null>(null)

  const total = data.reduce((a, d) => a + Math.max(0, d.value), 0)
  const chartData = data
    .filter((d) => d.value > 0)
    .map((d, i) => ({
      label: d.label,
      value: d.value,
      color: d.color ?? PALETTE[i % PALETTE.length],
    }))

  const size = height
  const cx = size / 2
  const cy = size / 2
  const outerRadius = Math.max(24, Math.floor(size / 2) - 4)
  const innerRadius = Math.max(10, outerRadius - thickness)
  const midRadius = (outerRadius + innerRadius) / 2

  if (!chartData.length) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-xs text-foreground-faint"
      >
        Sem dados
      </div>
    )
  }

  // Build arcs
  let cumAngle = 0
  const arcs = chartData.map((d) => {
    const angle = total > 0 ? (d.value / total) * 360 : 0
    const startAngle = cumAngle
    cumAngle += angle
    const endAngle = cumAngle
    return { ...d, startAngle, endAngle, angle }
  })

  return (
    <div
      style={{ height }}
      className="relative flex items-center justify-center w-full"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Gráfico donut"
      >
        {arcs.map((arc, i) => {
          // For a full circle (single item), use two half-arcs
          if (arc.angle >= 359.99) {
            return (
              <g key={`${uid}-${i}`}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={midRadius}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={thickness}
                  opacity={hovered === null || hovered === i ? 1 : 0.4}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                />
              </g>
            )
          }

          const path = describeArc(cx, cy, midRadius, arc.startAngle, arc.endAngle)
          return (
            <path
              key={`${uid}-${i}`}
              d={path}
              fill="none"
              stroke={arc.color}
              strokeWidth={thickness}
              strokeLinecap="butt"
              opacity={hovered === null || hovered === i ? 1 : 0.4}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
            />
          )
        })}
      </svg>

      {/* Tooltip on hover */}
      {hovered !== null && arcs[hovered] && (
        <div
          className="absolute top-1 left-1/2 -translate-x-1/2 rounded-xl border border-[var(--voux-border)] bg-[var(--voux-surface)] px-3 py-2 shadow-md text-xs pointer-events-none z-50"
          style={{ boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: arcs[hovered].color }}
            />
            <span className="font-medium">{arcs[hovered].label}</span>
          </div>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="font-bold text-sm">
              {arcs[hovered].value.toLocaleString('pt-BR')}
            </span>
            <span className="opacity-60">
              ({total > 0 ? ((arcs[hovered].value / total) * 100).toFixed(1) : '0'}%)
            </span>
          </div>
        </div>
      )}

      {/* Center label/value */}
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          {centerLabel && (
            <span
              className="text-[10px] font-semibold tracking-[0.16em] uppercase text-foreground-muted"
              style={{ fontFamily: 'var(--voux-font-mono)' }}
            >
              {centerLabel}
            </span>
          )}
          {centerValue && (
            <span
              className="text-base font-bold tracking-tight text-foreground"
              style={{ fontFamily: 'var(--voux-font-mono)' }}
            >
              {centerValue}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
