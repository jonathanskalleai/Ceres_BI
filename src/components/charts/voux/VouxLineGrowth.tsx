/**
 * VouxLineGrowth — porta React de lineGrowth() em charts.js
 *
 * Linha stroke 1.5 + área com gradiente vertical (0.20→0).
 * Ponto em cada mês (circle r=3, fill #18160f, stroke da cor).
 * % variação ACIMA de cada ponto (mono 10px, cor labelColor, formato "+67.00%").
 * Valor ABAIXO de cada ponto (mono 10px, cor #ece5d4).
 * Label do mês rotacionado -60° (mono 9px).
 * Divisores de ano DINÂMICOS calculados a partir de `mes_date`.
 */
import { useId } from 'react'
import { useElementWidth } from './useElementWidth'
import { fmtBRLCompact } from './format'

export interface LineGrowthItem {
  label: string
  /** ISO date string "YYYY-MM-DD" ou timestamp ISO completo "YYYY-MM-DDThh:mm:ss+00:00" para cálculo dinâmico de divisores de ano */
  mes_date?: string
  value: number
  growth: number | null
}

interface YearGroup {
  year: number
  startIdx: number
  endIdx: number
}

interface VouxLineGrowthProps {
  data: LineGrowthItem[]
  color: string
  labelColor?: string
  fmt?: (v: number) => string
  height?: number
}

const PAD_L = 24
const PAD_R = 24
const PAD_T = 60
const PAD_B = 56

/** Extrai grupos de anos a partir de mes_date.
 *  Funciona tanto com "YYYY-MM-DD" quanto com timestamp ISO completo
 *  "YYYY-MM-DDThh:mm:ss+00:00" — extrai os 4 primeiros caracteres da string,
 *  evitando concatenação de sufixo T00:00:00 que produzia string inválida. */
function extractYearGroups(data: LineGrowthItem[]): YearGroup[] {
  const groups: YearGroup[] = []
  data.forEach((d, i) => {
    if (!d.mes_date) return
    const year = Number(d.mes_date.slice(0, 4))
    if (!Number.isFinite(year)) return
    const last = groups[groups.length - 1]
    if (last && last.year === year) {
      last.endIdx = i
    } else {
      groups.push({ year, startIdx: i, endIdx: i })
    }
  })
  return groups
}

export function VouxLineGrowth({
  data,
  color,
  labelColor = '#d4a05a',
  fmt = fmtBRLCompact,
  height = 360,
}: VouxLineGrowthProps) {
  const uid = useId().replace(/:/g, '')
  const [containerRef, w] = useElementWidth<HTMLDivElement>()

  const h = height
  const plotW = w - PAD_L - PAD_R
  const plotH = h - PAD_T - PAD_B

  const values = data.map((d) => d.value)
  let maxV = Math.max(...values)
  let minV = Math.min(...values)
  if (maxV === minV) maxV = minV + 1
  const yRange = maxV - minV
  maxV = maxV + yRange * 0.12
  minV = Math.max(0, minV - yRange * 0.1)

  const xCoord = (i: number) =>
    PAD_L + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW)

  const yCoord = (v: number) =>
    PAD_T + plotH - ((v - minV) / (maxV - minV)) * plotH

  // build path strings
  const pathD = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xCoord(i)} ${yCoord(d.value)}`)
    .join(' ')

  const areaD =
    pathD +
    ` L ${xCoord(data.length - 1)} ${PAD_T + plotH} L ${xCoord(0)} ${PAD_T + plotH} Z`

  // dynamic year groups
  const yearGroups = extractYearGroups(data)

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Gráfico de linha com crescimento mensal"
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
            <linearGradient id={`${uid}-area`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* area fill */}
          <path d={areaD} fill={`url(#${uid}-area)`} />

          {/* line */}
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* points + labels */}
          {data.map((d, i) => {
            const cx = xCoord(i)
            const cy = yCoord(d.value)
            const growthLabel =
              d.growth !== null && d.growth !== undefined
                ? `${d.growth >= 0 ? '+' : ''}${d.growth.toFixed(2)}%`
                : null

            return (
              <g key={i}>
                {/* point */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={3}
                  fill="var(--voux-surface)"
                  stroke={color}
                  strokeWidth={1.5}
                />

                {/* growth % above */}
                {growthLabel !== null && (
                  <text
                    x={cx}
                    y={cy - 16}
                    textAnchor="middle"
                    fontFamily="var(--voux-font-mono)"
                    fontSize={10}
                    fill={labelColor}
                    letterSpacing="0.04em"
                  >
                    {growthLabel}
                  </text>
                )}

                {/* value below */}
                <text
                  x={cx}
                  y={cy + 18}
                  textAnchor="middle"
                  fontFamily="var(--voux-font-mono)"
                  fontSize={10}
                  fill="#ece5d4"
                  letterSpacing="0.02em"
                >
                  {fmt(d.value)}
                </text>

                {/* x label (month) rotated -60° */}
                <text
                  x={cx}
                  y={h - PAD_B + 22}
                  textAnchor="middle"
                  fontFamily="var(--voux-font-mono)"
                  fontSize={9}
                  fill="var(--voux-chart-axis)"
                  letterSpacing="0.10em"
                  transform={`rotate(-60 ${cx} ${h - PAD_B + 22})`}
                >
                  {d.label}
                </text>
              </g>
            )
          })}

          {/* dynamic year separators */}
          {yearGroups.length > 1 &&
            yearGroups.slice(0, -1).map((group, gi) => {
              // separator between this group's last idx and next group's first idx
              const splitIdx = group.endIdx
              const nextIdx = yearGroups[gi + 1].startIdx
              const xs = (xCoord(splitIdx) + xCoord(nextIdx)) / 2

              return (
                <g key={`year-sep-${gi}`}>
                  {/* vertical divider */}
                  <line
                    x1={xs}
                    x2={xs}
                    y1={PAD_T - 30}
                    y2={h - PAD_B + 30}
                    stroke="var(--voux-chart-grid)"
                    strokeWidth={1}
                  />
                </g>
              )
            })}

          {/* year labels centered under each group */}
          {yearGroups.length > 1 &&
            yearGroups.map((group) => {
              const midX =
                (xCoord(group.startIdx) + xCoord(group.endIdx)) / 2
              return (
                <text
                  key={`year-lbl-${group.year}`}
                  x={midX}
                  y={h - 6}
                  textAnchor="middle"
                  fontFamily="var(--voux-font-mono)"
                  fontSize={10}
                  fill="var(--voux-chart-axis)"
                  letterSpacing="0.18em"
                >
                  {String(group.year)}
                </text>
              )
            })}
        </svg>
      )}
    </div>
  )
}
