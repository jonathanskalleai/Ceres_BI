// hooks/useInsights.ts — Barrel re-export for BI Insights hooks
// Maintains identical public API after split into submodules.

export {
  useDashboards,
  useDashboard,
  useKPISuggestions,
  useKPI,
  useKPITrends,
  useInsightsQuery as useInsights,
  useInsight,
  useViewRelationships,
  useAnalytics,
  useInsightCategories,
  useDashboardCategories,
  useHealthCheck,
  useAgentAnalysisStatus,
} from './useInsightsQueries';

export {
  useDismissInsight,
  useDismissAllInsights,
  useMarkInsightAsRelevant,
  useBulkDismissInsights,
  useBulkMarkInsightsAsRelevant,
  useTriggerFullAnalysis,
  useTriggerDashboardAnalysis,
  useTriggerInsightGeneration,
} from './useInsightsMutations';

export {
  useDashboardNavigation,
  useInsightFilters,
} from './useInsightsNavigation';

// Export service for convenience (existing consumers use this)
export { insightsService } from '@/services/insightsService';
