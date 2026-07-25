// Barrel dos gráficos do BI (ECharts). API compatível com os antigos wrappers Nivo.
export {
  default as BarChart,
  VerticalBarChart,
  HorizontalBarChart,
  StackedBarChart,
  type BarChartData,
  type BarChartProps,
} from "./BarChart";
export {
  default as LineChart,
  type LineChartData,
  type LineChartSeriesItem,
  type LineChartProps,
} from "./LineChart";
export {
  default as PieChart,
  PieChartWithLabels,
  type PieChartData,
  type PieChartProps,
} from "./PieChart";
export {
  default as BrazilHeatmap,
  type BrazilHeatmapData,
  type BrazilHeatmapProps,
} from "./BrazilHeatmap";
export {
  default as ScatterChart,
  type ScatterChartProps,
  type ScatterPoint,
} from "./ScatterChart";
export {
  default as ComboChart,
  type ComboChartData,
  type ComboChartProps,
} from "./ComboChart";
