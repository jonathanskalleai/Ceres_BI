// useInsightsQueries.ts — Query hooks for BI Insights system

import { useQuery } from '@tanstack/react-query';
import { InsightFilters } from '@/types/insights';
import { insightsService } from '@/services/insightsService';

// Dashboard Queries
export const useDashboards = () => {
  return useQuery({
    queryKey: ['insights', 'dashboards'],
    queryFn: () => insightsService.getDashboardDefinitions(),
    staleTime: 1000 * 60 * 5,
  });
};

export const useDashboard = (id: string) => {
  return useQuery({
    queryKey: ['insights', 'dashboards', id],
    queryFn: () => insightsService.getDashboardById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
};

// KPI Queries
export const useKPISuggestions = (dashboardId?: string) => {
  return useQuery({
    queryKey: ['insights', 'kpis', dashboardId],
    queryFn: () => insightsService.getKPISuggestions(dashboardId),
    enabled: dashboardId !== undefined,
    staleTime: 1000 * 60 * 5,
  });
};

export const useKPI = (id: string) => {
  return useQuery({
    queryKey: ['insights', 'kpis', id],
    queryFn: () => insightsService.getKPIById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
};

export const useKPITrends = (kpiId: string, period: string) => {
  return useQuery({
    queryKey: ['insights', 'kpis', kpiId, 'trends', period],
    queryFn: () => insightsService.getKPITrends(kpiId, period),
    enabled: !!kpiId,
    staleTime: 1000 * 60 * 5,
  });
};

// Insights Queries
export const useInsightsQuery = (filters?: InsightFilters) => {
  return useQuery({
    queryKey: ['insights', 'insights', filters],
    queryFn: () => insightsService.getInsights(filters),
    staleTime: 1000 * 60 * 2,
  });
};

export const useInsight = (id: string) => {
  return useQuery({
    queryKey: ['insights', 'insights', id],
    queryFn: () => insightsService.getInsightById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  });
};

// View Relationships Queries
export const useViewRelationships = () => {
  return useQuery({
    queryKey: ['insights', 'view-relationships'],
    queryFn: () => insightsService.getViewRelationships(),
    staleTime: 1000 * 60 * 60,
  });
};

// Analytics Queries
export const useAnalytics = (period: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'month') => {
  return useQuery({
    queryKey: ['insights', 'analytics', period],
    queryFn: () => insightsService.getAnalytics(period),
    staleTime: 1000 * 60 * 5,
  });
};

export const useInsightCategories = () => {
  return useQuery({
    queryKey: ['insights', 'categories'],
    queryFn: () => insightsService.getInsightCategories(),
    staleTime: 1000 * 60 * 60,
  });
};

export const useDashboardCategories = () => {
  return useQuery({
    queryKey: ['insights', 'dashboard-categories'],
    queryFn: () => insightsService.getDashboardCategories(),
    staleTime: 1000 * 60 * 60,
  });
};

// Health Check Query
export const useHealthCheck = () => {
  return useQuery({
    queryKey: ['insights', 'health'],
    queryFn: () => insightsService.getHealthCheck(),
    staleTime: 1000 * 30,
  });
};

// Agent Analysis Status Query
export const useAgentAnalysisStatus = () => {
  return useQuery({
    queryKey: ['insights', 'analysis-status'],
    queryFn: () => insightsService.getAgentAnalysisStatus(),
    staleTime: 1000 * 30,
  });
};
