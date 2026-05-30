// types/insights.ts - Tipos para o sistema de BI e insights

export type Severity = 'critical' | 'warning' | 'info';

export type DashboardCategory =
  | 'crm-comercial'
  | 'funil-vendas'
  | 'pos-venda'
  | 'produtos'
  | 'equipe'
  | 'cliente-360'
  | 'pipeline'
  | 'agenda'
  | 'ordens-servico'
  | 'ocorrencias'
  | 'financeiro'
  | 'operacoes';

export type ChartType = 'bar' | 'line' | 'pie' | 'table' | 'combo' | 'area' | 'scatter';

export type MetricAggregation = 'sum' | 'avg' | 'count' | 'percentage' | 'max' | 'min';

export type MetricComparison =
  | 'same_month_last_year'
  | 'same_period_last_year'
  | 'previous_month'
  | 'previous_period'
  | 'quarter_over_quarter'
  | 'year_over_year';

export interface Insight {
  insight_id: string;
  title: string;
  description: string;
  category: string;
  severity: Severity;
  metric_type: string;
  metric_value?: number;
  metric_comparison?: 'growth' | 'decline' | 'stable';
  metric_percentage?: number;
  data_source: string;
  dashboard_id: string;
  sql_query: string;
  generated_at: Date;
  applied_filters: Record<string, any>;
  linked_entities: Record<string, any>;
  kpi_references: Record<string, any>;
  recommendation?: string;
  is_active: boolean;
  is_relevant: boolean;
}

export interface ViewMetadata {
  view_name: string;
  table_name: string;
  column_count: number;
  columns: ColumnMetadata[];
  description?: string;
  business_category?: string;
  data_type_distribution: Record<string, number>;
}

export interface ColumnMetadata {
  name: string;
  type: string;
  is_numeric: boolean;
  is_date: boolean;
  is_text: boolean;
  is_foreign_key: boolean;
  is_primary_key: boolean;
  nullable: boolean;
  description?: string;
  sample_values?: any[];
}

export interface DashboardDefinition {
  dashboard_id: string;
  title: string;
  description: string;
  icon: string;
  category: DashboardCategory;
  kpis: KPISuggestion[];
  charts_schema: ChartTypeSchema[];
  last_analyzed?: Date;
  is_active: boolean;
}

export interface KPISuggestion {
  kpi_id: string;
  dashboard_id: string;
  title: string;
  description?: string;
  metric_formula: string;
  metric_aggregation: MetricAggregation;
  metric_column: string;
  dimension_column?: string;
  dimension_grouping?: string;
  data_source: string;
  data_source_view?: string;
  priority: number;
  is_active: boolean;
  chart_type: ChartType;
  color_scheme?: string;
}

export interface ChartTypeSchema {
  type: ChartType;
  options: Record<string, any>;
  color_scheme?: string;
  dimensions?: string[];
}

export interface ViewRelationship {
  id: string;
  source_view: string;
  target_view: string;
  relationship_type: string;
  relationship_strength: number;
  description?: string;
  created_at: Date;
}

export interface MetricComparison {
  kpi_id: string;
  current_value: number;
  previous_value: number;
  period_comparison: MetricComparison;
  percentage_change: number;
  is_growth: boolean;
  trend: 'up' | 'down' | 'stable';
}

export interface BusinessContext {
  company_name: string;
  business_areas: BusinessArea[];
  key_performance_indicators: string[];
  data_maturity: 'basic' | 'intermediate' | 'advanced';
  integration_points: string[];
}

export interface BusinessArea {
  name: string;
  description: string;
  data_sources: string[];
  kpi_focus: string[];
  potential_insights: string[];
}

export interface AnalysisResult {
  view_metadata: ViewMetadata[];
  business_context: BusinessContext;
  suggested_dashboards: DashboardDefinition[];
  generated_insights: Insight[];
  view_relationships: ViewRelationship[];
}

export type Filters = {
  vendedor?: string;
  cidade?: string;
  periodo?: string;
  ano?: string;
  mes?: string;
  tipoAcao?: string;
  dashboard?: string;
  category?: string;
  severity?: Severity;
  dateRange?: {
    start: Date;
    end: Date;
  };
};

export interface InsightFilters {
  categories?: string[];
  severities?: Severity[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  dashboard_ids?: string[];
  data_sources?: string[];
  kpi_ids?: string[];
}

export interface QueryRequest {
  view: string;
  columns?: string[];
  filters?: Record<string, any>;
  groupBy?: string[];
  orderBy?: string[];
  limit?: number;
  offset?: number;
  count_only?: boolean;
  metric?: {
    column: string;
    aggregation: MetricAggregation;
    groupBy?: string[];
  };
}

export interface QueryResponse {
  data: any[];
  total?: number;
  columns: string[];
  query?: string;
}