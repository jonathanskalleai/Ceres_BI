import { Bar as NivoBar } from '@nivo/bar'
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
  height = 260,
  loading = false,
  tooltipFormatter,
  groupMode = 'grouped',
}: NivoBarChartProps) {
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-pulse bg-gray-200 rounded h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="w-full" style={{ height }}>
      <NivoBar
        width={800}
        height={height}
        data={data}
        indexBy="name"
        layout={layout}
        keys={keys}
        groupMode={groupMode}
        margin={{ top: 20, right: 20, bottom: 60, left: layout === 'horizontal' ? 120 : 60 }}
        borderRadius={4}
        enableGridX={layout === 'horizontal'}
        enableGridY={layout === 'vertical'}
        theme={nivoTheme}
        colors={colors as any}
        borderWidth={0}
        axisBottom={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: layout === 'vertical' ? -30 : 0,
          legend: layout === 'vertical' ? title : '',
          legendPosition: 'middle',
          legendOffset: 50,
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: layout === 'horizontal' ? title : '',
          legendPosition: 'middle',
          legendOffset: layout === 'horizontal' ? -100 : -45,
          format: (v) => tooltipFormatter ? tooltipFormatter(v as number) : String(v),
        }}
        tooltip={({ id, value, color, indexValue }) => (
          <div
            style={nivoTheme.tooltip.container as any}
            className="p-3 rounded-lg backdrop-blur-md"
          >
            <div className="text-sm font-semibold text-gray-100 mb-1">{String(indexValue)}</div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-sm text-gray-300">
                {String(id)}: {tooltipFormatter ? tooltipFormatter(value) : value}
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

export function NivoVerticalBarChart({
  data,
  keys,
  title,
  height = 260,
  loading = false,
  tooltipFormatter,
  colors,
}: Omit<NivoBarChartProps, 'layout' | 'groupMode'>) {
  return (
    <NivoBarChart
      data={data}
      layout="vertical"
      keys={keys}
      title={title}
      height={height}
      loading={loading}
      tooltipFormatter={tooltipFormatter}
      colors={colors}
    />
  )
}

export function NivoHorizontalBarChart({
  data,
  keys,
  title,
  height = 260,
  loading = false,
  tooltipFormatter,
  colors,
}: Omit<NivoBarChartProps, 'layout' | 'groupMode'>) {
  return (
    <NivoBarChart
      data={data}
      layout="horizontal"
      keys={keys}
      title={title}
      height={height}
      loading={loading}
      tooltipFormatter={tooltipFormatter}
      colors={colors}
    />
  )
}

export function NivoStackedBarChart({
  data,
  keys,
  title,
  height = 260,
  loading = false,
  tooltipFormatter,
}: Omit<NivoBarChartProps, 'layout'>) {
  return (
    <NivoBarChart
      data={data}
      layout="vertical"
      keys={keys}
      title={title}
      height={height}
      loading={loading}
      tooltipFormatter={tooltipFormatter}
      groupMode="stacked"
    />
  )
}
