// Shared types for DashboardBI sub-components

export interface HealthCheckData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  last_analyzed: string;
  total_insights: number;
  relevant_insights: number;
  dashboards_count: number;
  views_count: number;
}

export interface AgentAnalysisStatusData {
  view_analysis: 'completed' | 'in_progress' | 'failed';
  business_context: 'completed' | 'in_progress' | 'failed';
  insights_generation: 'completed' | 'in_progress' | 'failed';
  last_analysis_run?: Date;
  next_analysis_scheduled?: Date;
}
