import { ResponsiveLine } from '@nivo/line'
import { nivoTheme, NIVO_COLORS } from '@/lib/nivoTheme'

export interface NivoLineChartData {
  x: string | number
  y: number
}

export interface NivoLineChartProps {
  data: NivoLineChartData[]
  title?: string
  height?: number
  loading?: boolean
  color?: string
  strokeWidth?: number
  area?: boolean
  enableGrid?: boolean
  tooltipFormatter?: (value: number) => string
  curve?: 'monotoneX' | 'linear' | 'step' | 'stepBefore' | 'stepAfter' | 'natural' | 'basis'
}

export default function NivoLineChart({
  data,
  title,
  height = 280,
  loading = false,
  color = NIVO_COLORS[0],
  strokeWidth = 2,
  area = false,
  enableGrid = true,
  tooltipFormatter,
  curve = 'monotoneX',
}: NivoLineChartProps) {
  if (loading) {
    return (
      <div className="w-full animate-pulse bg-gray-100 rounded-lg" style={{ height }} />
    )
  }

  if (!data.length) {
    return (
      <div className="w-full flex items-center justify-center text-gray-400 text-sm" style={{ height }}>
        Sem dados
      </div>
    )
  }

  const nivoData = [{ id: title || 'série', data }]

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveLine
        data={nivoData}
        margin={{ top: 12, right: 16, bottom: 48, left: 56 }}
        xScale={{ type: 'point' }}
        yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false }}
        curve={curve as any}
        theme={nivoTheme}
        colors={[color]}
        lineWidth={strokeWidth}
        pointSize={6}
        pointColor="white"
        pointBorderWidth={2}
        pointBorderColor={color}
        enableArea={area}
        areaOpacity={0.12}
        enableGridX={false}
        enableGridY={enableGrid}
        gridYValues={5}
        axisBottom={{
          tickSize: 0,
          tickPadding: 10,
          tickRotation: data.length > 8 ? -30 : 0,
        }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 10,
          tickValues: 5,
          format: (v) => (typeof v === 'number' && tooltipFormatter) ? tooltipFormatter(v) : String(v),
        }}
        enableSlices="x"
        sliceTooltip={({ slice }) => {
          const point = slice.points[0]
          return (
            <div
              style={nivoTheme.tooltip.container as React.CSSProperties}
              className="px-3 py-2 rounded-lg shadow-lg"
            >
              <p className="text-xs font-semibold text-slate-400 mb-1">{String(point.data.x)}</p>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: point.serieColor }} />
                <span className="text-sm text-slate-100">
                  <strong>
                    {tooltipFormatter
                      ? tooltipFormatter(point.data.y as number)
                      : point.data.y}
                  </strong>
                </span>
              </div>
            </div>
          )
        }}
        animate={true}
        motionConfig="gentle"
      />
    </div>
  )
}
