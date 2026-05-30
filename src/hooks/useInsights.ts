// hooks/useInsights.ts - Hooks para o sistema de BI e Insights

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DashboardDefinition,
  KPISuggestion,
  Insight,
  InsightFilters,
  ViewRelationship,
  MetricComparison
} from '@/types/insights';
import { insightsService } from '@/services/insightsService';

// Dashboard Queries
export const useDashboards = () => {
  return useQuery({
    queryKey: ['insights', 'dashboards'],
    queryFn: () => insightsService.getDashboardDefinitions(),
    staleTime: 1000 * 60 * 5, // 5 minutes
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
export const useInsights = (filters?: InsightFilters) => {
  return useQuery({
    queryKey: ['insights', 'insights', filters],
    queryFn: () => insightsService.getInsights(filters),
    staleTime: 1000 * 60 * 2, // 2 minutes for fresh data
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
    staleTime: 1000 * 60 * 60, // 1 hour - relationships don't change often
  });
};

// Analytics Queries
export const useAnalytics = (period: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'month') => {
  return useQuery({
    queryKey: ['insights', 'analytics', period],
    queryFn: () => insightsService.getAnalytics(period),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useInsightCategories = () => {
  return useQuery({
    queryKey: ['insights', 'categories'],
    queryFn: () => insightsService.getInsightCategories(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
};

export const useDashboardCategories = () => {
  return useQuery({
    queryKey: ['insights', 'dashboard-categories'],
    queryFn: () => insightsService.getDashboardCategories(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
};

// Health Check Query
export const useHealthCheck = () => {
  return useQuery({
    queryKey: ['insights', 'health'],
    queryFn: () => insightsService.getHealthCheck(),
    staleTime: 1000 * 30, // 30 seconds
  });
};

// Agent Analysis Status Query
export const useAgentAnalysisStatus = () => {
  return useQuery({
    queryKey: ['insights', 'analysis-status'],
    queryFn: () => insightsService.getAgentAnalysisStatus(),
    staleTime: 1000 * 30, // 30 seconds
  });
};

// Mutations
export const useDismissInsight = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => insightsService.dismissInsight(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      toast.success('Insight ignorado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao ignorar insight');
      console.error('Dismiss insight error:', error);
    },
  });
};

export const useDismissAllInsights = (category?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => insightsService.dismissAllInsights(category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      toast.success(category ? `Todos os insights da categoria ${category} foram ignorados` : 'Todos os insights foram ignorados');
    },
    onError: (error) => {
      toast.error('Erro ao ignorar insights');
      console.error('Dismiss all insights error:', error);
    },
  });
};

export const useMarkInsightAsRelevant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, relevant }: { id: string; relevant: boolean }) =>
      insightsService.markInsightAsRelevant(id, relevant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      toast.success('Relevância atualizada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar relevância');
      console.error('Mark insight as relevant error:', error);
    },
  });
};

export const useBulkDismissInsights = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (insightIds: string[]) => insightsService.bulkDismissInsights(insightIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      toast.success('Insights ignorados em lote com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao ignorar insights em lote');
      console.error('Bulk dismiss insights error:', error);
    },
  });
};

export const useBulkMarkInsightsAsRelevant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ insightIds, relevant }: { insightIds: string[]; relevant: boolean }) =>
      insightsService.bulkMarkInsightsAsRelevant(insightIds, relevant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      toast.success('Relevância atualizada em lote com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar relevância em lote');
      console.error('Bulk mark insights as relevant error:', error);
    },
  });
};

// Analysis Mutations
export const useTriggerFullAnalysis = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => insightsService.triggerFullAnalysis(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights', 'analysis-status'] });
      toast.success('Análise completa iniciada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao iniciar análise completa');
      console.error('Trigger full analysis error:', error);
    },
  });
};

export const useTriggerDashboardAnalysis = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dashboardId: string) => insightsService.triggerDashboardAnalysis(dashboardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights', 'analysis-status'] });
      toast.success('Análise do dashboard iniciada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao iniciar análise do dashboard');
      console.error('Trigger dashboard analysis error:', error);
    },
  });
};

export const useTriggerInsightGeneration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => insightsService.triggerInsightGeneration(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights', 'analysis-status'] });
      toast.success('Geração de insights iniciada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao iniciar geração de insights');
      console.error('Trigger insight generation error:', error);
    },
  });
};

// Custom Hook for Dashboard Navigation State
export const useDashboardNavigation = () => {
  const [currentDashboard, setCurrentDashboard] = useState<string | null>(null);
  const [currentInsight, setCurrentInsight] = useState<string | null>(null);

  const navigateToDashboard = useCallback((dashboardId: string) => {
    setCurrentDashboard(dashboardId);
    setCurrentInsight(null);
  }, []);

  const navigateToInsight = useCallback((insightId: string) => {
    setCurrentInsight(insightId);
  }, []);

  const navigateBack = useCallback(() => {
    setCurrentInsight(null);
  }, []);

  const resetNavigation = useCallback(() => {
    setCurrentDashboard(null);
    setCurrentInsight(null);
  }, []);

  return {
    currentDashboard,
    currentInsight,
    navigateToDashboard,
    navigateToInsight,
    navigateBack,
    resetNavigation,
    hasActiveInsight: !!currentInsight,
    hasActiveDashboard: !!currentDashboard
  };
};

// Custom Hook for Filters
export const useInsightFilters = () => {
  const [filters, setFilters] = useState<InsightFilters>({});

  const updateFilters = useCallback((newFilters: Partial<InsightFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const hasActiveFilters = Object.keys(filters).length > 0;

  return {
    filters,
    updateFilters,
    clearFilters,
    hasActiveFilters
  };
};

// Export all hooks and types for convenience
export {
  insightsService
};