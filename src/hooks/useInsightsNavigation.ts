// useInsightsNavigation.ts — Navigation & filter state hooks for Insights

import { useState, useCallback } from 'react';
import { InsightFilters } from '@/types/insights';

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
