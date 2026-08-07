// service/insightsService.ts - Serviço de BI e Insights

import {
  DashboardDefinition,
  KPISuggestion,
  Insight,
  ViewRelationship,
  InsightFilters,
  MetricComparison
} from "@/types/insights";

/** Shared fetch wrapper — validates response and provides contextual error. */
async function fetchJson<T>(url: string, caller: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json() as T;
  } catch (err) {
    throw new Error(`[insightsService.${caller}] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/** Fire-and-forget fetch wrapper for void endpoints. */
async function fetchVoid(url: string, caller: string, init?: RequestInit): Promise<void> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (err) {
    throw new Error(`[insightsService.${caller}] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

export const insightsService = {
  // Dashboard Definitions
  async getDashboardDefinitions(): Promise<DashboardDefinition[]> {
    return fetchJson('/api/insights/dashboards', 'getDashboardDefinitions');
  },

  async getDashboardById(id: string): Promise<DashboardDefinition> {
    return fetchJson(`/api/insights/dashboards/${id}`, 'getDashboardById');
  },

  async createDashboard(dashboard: Omit<DashboardDefinition, 'last_analyzed'>): Promise<DashboardDefinition> {
    return fetchJson('/api/insights/dashboards', 'createDashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dashboard)
    });
  },

  async updateDashboard(id: string, dashboard: Partial<DashboardDefinition>): Promise<DashboardDefinition> {
    return fetchJson(`/api/insights/dashboards/${id}`, 'updateDashboard', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dashboard)
    });
  },

  // KPI Suggestions
  async getKPISuggestions(dashboardId?: string): Promise<KPISuggestion[]> {
    const params = dashboardId ? `?dashboardId=${dashboardId}` : '';
    return fetchJson(`/api/insights/kpis${params}`, 'getKPISuggestions');
  },

  async getKPIById(id: string): Promise<KPISuggestion> {
    return fetchJson(`/api/insights/kpis/${id}`, 'getKPIById');
  },

  async getKPITrends(kpiId: string, period: string): Promise<MetricComparison[]> {
    return fetchJson(`/api/insights/kpis/${kpiId}/trends?period=${period}`, 'getKPITrends');
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
    return fetchJson(`/api/insights/insights?${params}`, 'getInsights');
  },

  async getInsightById(id: string): Promise<Insight> {
    return fetchJson(`/api/insights/insights/${id}`, 'getInsightById');
  },

  async dismissInsight(id: string): Promise<void> {
    return fetchVoid(`/api/insights/insights/${id}/dismiss`, 'dismissInsight', { method: 'POST' });
  },

  async dismissAllInsights(category?: string): Promise<void> {
    const params = category ? `?category=${category}` : '';
    return fetchVoid(`/api/insights/insights/dismiss-all${params}`, 'dismissAllInsights', { method: 'POST' });
  },

  async markInsightAsRelevant(id: string, relevant: boolean): Promise<void> {
    return fetchVoid(`/api/insights/insights/${id}/relevance`, 'markInsightAsRelevant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relevant })
    });
  },

  // View Relationships
  async getViewRelationships(): Promise<ViewRelationship[]> {
    return fetchJson('/api/insights/view-relationships', 'getViewRelationships');
  },

  async getViewRelationshipByViews(source: string, target: string): Promise<ViewRelationship | null> {
    try {
      const response = await fetch(`/api/insights/view-relationships/${source}/${target}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return await response.json() as ViewRelationship;
    } catch (err) {
      throw new Error(`[insightsService.getViewRelationshipByViews] ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  },

  async createViewRelationship(relationship: Omit<ViewRelationship, 'id' | 'created_at'>): Promise<ViewRelationship> {
    return fetchJson('/api/insights/view-relationships', 'createViewRelationship', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(relationship)
    });
  },

  // Analytics
  async getAnalytics(period: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'month') {
    return fetchJson(`/api/insights/analytics?period=${period}`, 'getAnalytics');
  },

  async getInsightCategories(): Promise<{ [key: string]: number }> {
    return fetchJson('/api/insights/categories', 'getInsightCategories');
  },

  async getDashboardCategories(): Promise<{ [key: string]: number }> {
    return fetchJson('/api/insights/dashboard-categories', 'getDashboardCategories');
  },

  // Bulk operations
  async bulkDismissInsights(insightIds: string[]): Promise<void> {
    return fetchVoid('/api/insights/insights/bulk-dismiss', 'bulkDismissInsights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insightIds })
    });
  },

  async bulkMarkInsightsAsRelevant(insightIds: string[], relevant: boolean): Promise<void> {
    return fetchVoid('/api/insights/insights/bulk-relevance', 'bulkMarkInsightsAsRelevant', {
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
    return fetchJson('/api/insights/health', 'getHealthCheck');
  },

  // Agent Analysis Status
  async getAgentAnalysisStatus(): Promise<{
    view_analysis: 'completed' | 'in_progress' | 'failed';
    business_context: 'completed' | 'in_progress' | 'failed';
    insights_generation: 'completed' | 'in_progress' | 'failed';
    last_analysis_run?: Date;
    next_analysis_scheduled?: Date;
  }> {
    return fetchJson('/api/insights/analysis-status', 'getAgentAnalysisStatus');
  },

  // Trigger analysis
  async triggerFullAnalysis(): Promise<void> {
    return fetchVoid('/api/insights/analyze', 'triggerFullAnalysis', { method: 'POST' });
  },

  async triggerDashboardAnalysis(dashboardId: string): Promise<void> {
    return fetchVoid(`/api/insights/analyze-dashboard/${dashboardId}`, 'triggerDashboardAnalysis', { method: 'POST' });
  },

  async triggerInsightGeneration(): Promise<void> {
    return fetchVoid('/api/insights/generate-insights', 'triggerInsightGeneration', { method: 'POST' });
  }
};

// Export convenience hooks for React Query
export const useInsightsService = () => insightsService;
