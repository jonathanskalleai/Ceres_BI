// useInsightsMutations.ts — Mutation hooks for BI Insights system

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { insightsService } from '@/services/insightsService';

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
