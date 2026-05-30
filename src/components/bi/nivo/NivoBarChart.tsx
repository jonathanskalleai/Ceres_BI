import { ResponsiveBar } from '@nivo/bar'
import { nivoTheme, NIVO_COLORS } from '@/lib/nivoTheme'

export interface NivoBarChartData {
  name: string
  [key: string]: string | number
}

export interface NivoBarChartProps {
  data: NivoBarChartData[]
  layout?: 'horizontal' | 'vertical'
  keys: string[]
  colors?: string[]
  title?: string
  height?: number
  loading?: boolean
  tooltipFormatter?: (value: number) => string
  groupMode?: 'grouped' | 'stacked'
}

export default function NivoBarChart({
  data,
  layout = 'vertical',
  keys,
  colors = NIVO_COLORS,
  title,
  height = 280,
  loading = false,
  tooltipFormatter,
  groupMode = 'grouped',
}: NivoBarChartProps) {
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

  const isHorizontal = layout === 'horizontal'
  const marginLeft = isHorizontal ? Math.min(140, Math.max(...data.map(d => String(d.name).length)) * 7 + 16) : 52
  const marginBottom = isHorizontal ? 40 : 56

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveBar
        data={data}
        indexBy="name"
        layout={layout}
        keys={keys}
        groupMode={groupMode}
        margin={{ top: 12, right: 16, bottom: marginBottom, left: marginLeft }}
        borderRadius={3}
        enableGridX={isHorizontal}
        enableGridY={!isHorizontal}
        gridYValues={5}
        gridXValues={5}
        theme={nivoTheme}
        colors={colors as any}
        borderWidth={0}
        enableLabel={false}
        axisBottom={isHorizontal ? {
          tickSize: 0,
          tickPadding: 8,
          format: (v) => (typeof v === 'number' && tooltipFormatter) ? tooltipFormatter(v) : String(v ?? ''),
        } : {
          tickSize: 0,
          tickPadding: 8,
          tickRotation: data.length > 6 ? -30 : 0,
        }}
        axisLeft={isHorizontal ? {
          tickSize: 0,
          tickPadding: 10,
        } : {
          tickSize: 0,
          tickPadding: 8,
          tickValues: 5,
          format: (v) => (typeof v === 'number' && tooltipFormatter) ? tooltipFormatter(v) : String(v ?? ''),
        }}
        tooltip={({ id, value, color, indexValue }) => (
          <div
            style={nivoTheme.tooltip.container as React.CSSProperties}
            className="px-3 py-2 rounded-lg shadow-lg"
          >
            <p className="text-xs font-semibold text-slate-400 mb-1">{String(indexValue)}</p>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-sm text-slate-100">
                {String(id)}: <strong>{tooltipFormatter ? tooltipFormatter(value) : value}</strong>
              </span>
            </div>
          </div>
        )}
        role="img"
        ariaLabel={title || 'Bar chart'}
      />
    </div>
  )
}

export function NivoVerticalBarChart(props: Omit<NivoBarChartProps, 'layout' | 'groupMode'>) {
  return <NivoBarChart {...props} layout="vertical" />
}

export function NivoHorizontalBarChart(props: Omit<NivoBarChartProps, 'layout' | 'groupMode'>) {
  return <NivoBarChart {...props} layout="horizontal" />
}

export function NivoStackedBarChart(props: Omit<NivoBarChartProps, 'layout'>) {
  return <NivoBarChart {...props} layout="vertical" groupMode="stacked" />
}
