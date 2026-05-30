// Registro modular do ECharts — importa SOMENTE os charts e components usados
// no BI para manter o bundle enxuto (tree-shaking). Todos os wrappers em
// src/components/bi/charts/* usam este `echarts` via echarts-for-react/lib/core.
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);

export default echarts;
