// service/insightsService.ts - Serviço de BI e Insights

import {
  DashboardDefinition,
  KPISuggestion,
  Insight,
  ViewRelationship,
  InsightFilters,
  MetricComparison
} from "@/types/insights";

export const insightsService = {
  // Dashboard Definitions
  async getDashboardDefinitions(): Promise<DashboardDefinition[]> {
    const response = await fetch('/api/insights/dashboards');
    return response.json();
  },

  async getDashboardById(id: string): Promise<DashboardDefinition> {
    const response = await fetch(`/api/insights/dashboards/${id}`);
    return response.json();
  },

  async createDashboard(dashboard: Omit<DashboardDefinition, 'last_analyzed'>): Promise<DashboardDefinition> {
    const response = await fetch('/api/insights/dashboards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dashboard)
    });
    return response.json();
  },

  async updateDashboard(id: string, dashboard: Partial<DashboardDefinition>): Promise<DashboardDefinition> {
    const response = await fetch(`/api/insights/dashboards/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dashboard)
    });
    return response.json();
  },

  // KPI Suggestions
  async getKPISuggestions(dashboardId?: string): Promise<KPISuggestion[]> {
    const params = dashboardId ? `?dashboardId=${dashboardId}` : '';
    const response = await fetch(`/api/insights/kpis${params}`);
    return response.json();
  },

  async getKPIById(id: string): Promise<KPISuggestion> {
    const response = await fetch(`/api/insights/kpis/${id}`);
    return response.json();
  },

  async getKPITrends(kpiId: string, period: string): Promise<MetricComparison[]> {
    const response = await fetch(`/api/insights/kpis/${kpiId}/trends?period=${period}`);
    return response.json();
  },

  // Insights
  async getInsights(filters?: InsightFilters): Promise<Insight[]> {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.categories) params.append('categories', filters.categories.join(','));
      if (filters.severities) params.append('severities', filters.severities.join(','));
      if (filters.dashboard_ids) params.append('dashboard_ids', filters.dashboard_ids.join(','));
      if (filters.data_sources) params.append('data_sources', filters.data_sources.join(','));
      if (filters.dateRange) {
        params.append('startDate', filters.dateRange.start.toISOString());
        params.append('endDate', filters.dateRange.end.toISOString());
      }
    }

    const response = await fetch(`/api/insights/insights?${params}`);
    return response.json();
  },

  async getInsightById(id: string): Promise<Insight> {
    const response = await fetch(`/api/insights/insights/${id}`);
    return response.json();
  },

  async dismissInsight(id: string): Promise<void> {
    await fetch(`/api/insights/insights/${id}/dismiss`, {
      method: 'POST'
    });
  },

  async dismissAllInsights(category?: string): Promise<void> {
    const params = category ? `?category=${category}` : '';
    await fetch(`/api/insights/insights/dismiss-all${params}`, {
      method: 'POST'
    });
  },

  async markInsightAsRelevant(id: string, relevant: boolean): Promise<void> {
    await fetch(`/api/insights/insights/${id}/relevance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relevant })
    });
  },

  // View Relationships
  async getViewRelationships(): Promise<ViewRelationship[]> {
    const response = await fetch('/api/insights/view-relationships');
    return response.json();
  },

  async getViewRelationshipByViews(source: string, target: string): Promise<ViewRelationship | null> {
    const response = await fetch(`/api/insights/view-relationships/${source}/${target}`);
    if (response.status === 404) return null;
    return response.json();
  },

  async createViewRelationship(relationship: Omit<ViewRelationship, 'id' | 'created_at'>): Promise<ViewRelationship> {
    const response = await fetch('/api/insights/view-relationships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(relationship)
    });
    return response.json();
  },

  // Analytics
  async getAnalytics(period: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'month') {
    const response = await fetch(`/api/insights/analytics?period=${period}`);
    return response.json();
  },

  async getInsightCategories(): Promise<{ [key: string]: number }> {
    const response = await fetch('/api/insights/categories');
    return response.json();
  },

  async getDashboardCategories(): Promise<{ [key: string]: number }> {
    const response = await fetch('/api/insights/dashboard-categories');
    return response.json();
  },

  // Bulk operations
  async bulkDismissInsights(insightIds: string[]): Promise<void> {
    await fetch('/api/insights/insights/bulk-dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insightIds })
    });
  },

  async bulkMarkInsightsAsRelevant(insightIds: string[], relevant: boolean): Promise<void> {
    await fetch('/api/insights/insights/bulk-relevance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insightIds, relevant })
    });
  },

  // Health check
  async getHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    last_analyzed: string;
    total_insights: number;
    relevant_insights: number;
    dashboards_count: number;
    views_count: number;
  }> {
    const response = await fetch('/api/insights/health');
    return response.json();
  },

  // Agent Analysis Status
  async getAgentAnalysisStatus(): Promise<{
    view_analysis: 'completed' | 'in_progress' | 'failed';
    business_context: 'completed' | 'in_progress' | 'failed';
    insights_generation: 'completed' | 'in_progress' | 'failed';
    last_analysis_run?: Date;
    next_analysis_scheduled?: Date;
  }> {
    const response = await fetch('/api/insights/analysis-status');
    return response.json();
  },

  // Trigger analysis
  async triggerFullAnalysis(): Promise<void> {
    await fetch('/api/insights/analyze', {
      method: 'POST'
    });
  },

  async triggerDashboardAnalysis(dashboardId: string): Promise<void> {
    await fetch(`/api/insights/analyze-dashboard/${dashboardId}`, {
      method: 'POST'
    });
  },

  async triggerInsightGeneration(): Promise<void> {
    await fetch('/api/insights/generate-insights', {
      method: 'POST'
    });
  }
};

// Export convenience hooks for React Query
export const useInsightsService = () => insightsService;