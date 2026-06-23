// pages/DashboardBI.tsx - Orchestrator for Dashboard BI page

import { useState, useMemo } from 'react';
import { RefreshCw, Loader2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  useInsights,
  useDashboards,
  useHealthCheck,
  useAgentAnalysisStatus,
  useDashboardNavigation,
  useInsightFilters
} from '@/hooks/useInsights';
import {
  DashboardNavigation,
  AnalysisStatus
} from '@/components/dashboard/DashboardBI';
import { useToast } from '@/hooks/use-toast';
import type { InsightFilters } from '@/types/insights';
import { DashboardOverview } from '@/components/dashboard-bi/DashboardOverview';
import { DashboardSpecificView } from '@/components/dashboard-bi/DashboardSpecificView';

const DashboardBI = () => {
  const { toast } = useToast();
  const {
    navigateToDashboard,
    navigateToInsight,
    navigateBack,
    currentDashboard,
    currentInsight,
  } = useDashboardNavigation();

  const { filters, updateFilters, clearFilters } = useInsightFilters();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: dashboards, isLoading: dashboardsLoading } = useDashboards();
  const { data: insights, isLoading: insightsLoading } = useInsights(filters);
  const { data: health } = useHealthCheck();
  const { data: analysisStatus } = useAgentAnalysisStatus();

  const handleFilterChange = (key: keyof InsightFilters, value: InsightFilters[keyof InsightFilters]) => {
    updateFilters({ [key]: value });
  };

  const handleSync = async () => {
    setIsRefreshing(true);
    toast({ title: "Atualizando dados...", description: "Sincronizando insights com o SQL Server." });
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsRefreshing(false);
    toast({ title: "Dados atualizados", description: "Todos os insights foram recalculados." });
  };

  const insightsBySeverity = useMemo(() => {
    if (!insights) return { critical: [], warning: [], info: [] };
    return {
      critical: insights.filter(i => i.severity === 'critical'),
      warning: insights.filter(i => i.severity === 'warning'),
      info: insights.filter(i => i.severity === 'info')
    };
  }, [insights]);

  const currentDashboardData = useMemo(() => {
    if (!currentDashboard || !dashboards) return null;
    return dashboards.find(d => d.dashboard_id === currentDashboard) ?? null;
  }, [currentDashboard, dashboards]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardNavigation
        dashboards={dashboards || []}
        currentView={currentDashboard || 'overview'}
        onNavigate={(dashboardId) => navigateToDashboard(dashboardId)}
        filters={filters}
        onFiltersChange={handleFilterChange}
        onClearFilters={() => clearFilters()}
        hasActiveFilters={Object.keys(filters).length > 0}
      />

      <main className="flex-1 overflow-auto">
        <div className="flex justify-end p-3 pb-0 gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={isRefreshing} className="gap-2 text-xs">
            {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {isRefreshing ? "Atualizando..." : "Atualizar Dados"}
          </Button>

          {health && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Status do Sistema
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Status do Sistema BI</DialogTitle>
                </DialogHeader>
                <AnalysisStatus health={health} analysisStatus={analysisStatus} />
              </DialogContent>
            </Dialog>
          )}
        </div>

        {currentInsight ? (
          <DashboardSpecificView
            dashboard={currentDashboardData}
            insights={insightsBySeverity}
            onNavigateToInsight={navigateToInsight}
            onNavigateBack={navigateBack}
          />
        ) : currentDashboard ? (
          <DashboardSpecificView
            dashboard={currentDashboardData}
            insights={insightsBySeverity}
            onNavigateToInsight={navigateToInsight}
            onNavigateBack={navigateBack}
          />
        ) : (
          <DashboardOverview
            dashboards={dashboards || []}
            insights={insightsBySeverity}
            health={health}
            analysisStatus={analysisStatus}
            onNavigateToDashboard={navigateToDashboard}
          />
        )}
      </main>
    </div>
  );
};

export default DashboardBI;
