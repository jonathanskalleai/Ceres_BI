import { ResponsivePie } from '@nivo/pie'
import { nivoTheme, NIVO_COLORS } from '@/lib/nivoTheme'

export interface NivoPieChartData {
  id: string
  value: number
  name: string
}

export interface NivoPieChartProps {
  data: NivoPieChartData[]
  title?: string
  height?: number
  loading?: boolean
  colors?: string[]
  innerRadius?: number
  padAngle?: number
  cornerRadius?: number
  enableLabels?: boolean
  tooltipFormatter?: (value: number) => string
  labelFormatter?: (data: NivoPieChartData) => string
}

export default function NivoPieChart({
  data,
  title,
  height = 280,
  loading = false,
  colors = NIVO_COLORS,
  innerRadius = 0,
  padAngle = 1.5,
  cornerRadius = 3,
  enableLabels = true,
  tooltipFormatter,
}: NivoPieChartProps) {
  if (loading) {
    return (
      <div className="w-full animate-pulse bg-gray-100 rounded-full mx-auto" style={{ height, maxWidth: height }} />
    )
  }

  if (!data.length) {
    return (
      <div className="w-full flex items-center justify-center text-gray-400 text-sm" style={{ height }}>
        Sem dados
      </div>
    )
  }

  const normalizedInnerRadius = innerRadius > 1 ? innerRadius / 100 : innerRadius

  return (
    <div className="w-full" style={{ height }}>
      <ResponsivePie
        data={data}
        margin={{ top: 20, right: enableLabels ? 80 : 20, bottom: 20, left: enableLabels ? 80 : 20 }}
        innerRadius={normalizedInnerRadius}
        padAngle={padAngle}
        cornerRadius={cornerRadius}
        colors={colors as any}
        borderWidth={0}
        theme={nivoTheme}
        enableArcLabels={enableLabels}
        enableArcLinkLabels={enableLabels}
        arcLabelsSkipAngle={15}
        arcLinkLabelsSkipAngle={10}
        arcLinkLabelsThickness={1}
        arcLinkLabelsColor={{ from: 'color' }}
        arcLinkLabelsTextColor={{ from: 'color', modifiers: [['brighter', 1.5]] }}
        arcLabelsTextColor="#ffffff"
        tooltip={({ datum }) => (
          <div
            style={nivoTheme.tooltip.container as React.CSSProperties}
            className="px-3 py-2 rounded-lg shadow-lg"
          >
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: datum.color }} />
              <span className="text-sm text-slate-100">
                {datum.label || datum.id}:{' '}
                <strong>{tooltipFormatter ? tooltipFormatter(datum.value) : datum.value}</strong>
              </span>
            </div>
          </div>
        )}
        animate={true}
        motionConfig="gentle"
        role="img"
        ariaLabel={title || 'Pie chart'}
      />
    </div>
  )
}

export function NivoPieChartWithLabels({
  data,
  title,
  height = 280,
  loading = false,
  colors,
  tooltipFormatter,
}: Omit<NivoPieChartProps, 'innerRadius' | 'padAngle' | 'cornerRadius' | 'enableLabels'>) {
  return (
    <NivoPieChart
      data={data}
      title={title}
      height={height}
      loading={loading}
      colors={colors}
      tooltipFormatter={tooltipFormatter}
      innerRadius={0}
      padAngle={1.5}
      cornerRadius={3}
      enableLabels={true}
    />
  )
}

export function NivoDonutChart({
  data,
  title,
  height = 280,
  loading = false,
  colors,
  tooltipFormatter,
  innerRadius = 60,
}: Omit<NivoPieChartProps, 'padAngle' | 'cornerRadius' | 'enableLabels'>) {
  return (
    <NivoPieChart
      data={data}
      title={title}
      height={height}
      loading={loading}
      colors={colors}
      tooltipFormatter={tooltipFormatter}
      innerRadius={innerRadius}
      padAngle={1.5}
      cornerRadius={3}
      enableLabels={false}
    />
  )
}
