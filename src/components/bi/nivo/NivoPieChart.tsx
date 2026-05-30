import { Pie as NivoPie } from '@nivo/pie'
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
  labelFormatter?: (data: NivoPieChartData) => string
}

export default function NivoPieChart({
  data,
  title,
  height = 260,
  loading = false,
  colors = NIVO_COLORS,
  innerRadius = 0,
  padAngle = 2,
  cornerRadius = 4,
  enableLabels = true,
  labelFormatter,
}: NivoPieChartProps) {
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-pulse bg-gray-200 rounded h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="w-full" style={{ height }}>
      <NivoPie
        width={800}
        height={height}
        data={data}
        margin={{ top: 20, right: 80, bottom: 20, left: 80 }}
        innerRadius={innerRadius / 100}
        padAngle={padAngle}
        cornerRadius={cornerRadius}
        colors={colors as any}
        borderWidth={1}
        borderColor={{ from: 'color', modifiers: [['darker', 0.6]] }}
        theme={nivoTheme}
        tooltip={({ datum }) => (
          <div
            style={nivoTheme.tooltip.container as any}
            className="p-3 rounded-lg backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: datum.color }} />
              <span className="text-sm text-gray-300">
                {datum.label || datum.id}: {datum.value}
              </span>
            </div>
          </div>
        )}
        animate={true}
        role="img"
        ariaLabel={title || 'Pie chart'}
      />
    </div>
  )
}

export function NivoPieChartWithLabels({
  data,
  title,
  height = 260,
  loading = false,
  colors,
  labelFormatter,
}: Omit<NivoPieChartProps, 'innerRadius' | 'padAngle' | 'cornerRadius' | 'enableLabels'>) {
  return (
    <NivoPieChart
      data={data}
      title={title}
      height={height}
      loading={loading}
      colors={colors}
      innerRadius={0}
      padAngle={2}
      cornerRadius={4}
      enableLabels={true}
      labelFormatter={labelFormatter}
    />
  )
}

export function NivoDonutChart({
  data,
  title,
  height = 260,
  loading = false,
  colors,
  innerRadius = 60,
}: Omit<NivoPieChartProps, 'padAngle' | 'cornerRadius' | 'enableLabels'>) {
  return (
    <NivoPieChart
      data={data}
      title={title}
      height={height}
      loading={loading}
      colors={colors}
      innerRadius={innerRadius}
      padAngle={2}
      cornerRadius={4}
      enableLabels={false}
    />
  )
}
