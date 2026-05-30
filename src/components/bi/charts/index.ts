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
  type LineChartProps,
} from "./LineChart";
export {
  default as PieChart,
  PieChartWithLabels,
  type PieChartData,
  type PieChartProps,
} from "./PieChart";
