// DashboardOverview - Vista geral com cards de dashboards e insights

import {
  AlertTriangle,
  Lightbulb,
  BarChart3,
  TrendingUp,
  Target,
  Database
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardDefinition, Insight } from '@/types/insights';
import type { HealthCheckData, AgentAnalysisStatusData } from './types';
import { AnalysisStatusBadge } from './AnalysisStatusBadge';
import { InsightSummaryCard } from './InsightSummaryCard';

interface InsightsBySeverity {
  critical: Insight[];
  warning: Insight[];
  info: Insight[];
}

interface DashboardOverviewProps {
  dashboards: DashboardDefinition[];
  insights: InsightsBySeverity;
  health: HealthCheckData | undefined;
  analysisStatus: AgentAnalysisStatusData | undefined;
  onNavigateToDashboard: (dashboardId: string) => void;
}

export const DashboardOverview = ({
  dashboards,
  insights,
  health,
  analysisStatus,
  onNavigateToDashboard
}: DashboardOverviewProps) => {
  const isLoading = !dashboards || !insights;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard BI</h1>
          <p className="text-muted-foreground">
            Análise inteligente de dados por agentes para insights de gestão
          </p>
        </div>

        <div className="flex items-center gap-2">
          <AnalysisStatusBadge analysisStatus={analysisStatus} />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dashboards Ativos</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboards.length}</div>
            <p className="text-xs text-muted-foreground">Categorias de negócio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Insights Ativos</CardTitle>
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insights.critical.length + insights.warning.length + insights.info.length}
            </div>
            <p className="text-xs text-muted-foreground">Relevantes para análise</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Criticidade</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{insights.critical.length}</div>
            <p className="text-xs text-muted-foreground">Insights críticos</p>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard Grid */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Dashboards Estratégicos</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))
          ) : (
            dashboards.map((dashboard) => (
              <Card key={dashboard.dashboard_id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{dashboard.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {dashboard.description}
                      </p>
                    </div>
                    <Badge variant="secondary">{dashboard.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Database className="h-4 w-4" />
                      <span>{dashboard.kpis.length} KPIs definidos</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      <span>{dashboard.charts_schema.length} gráficos configurados</span>
                    </div>
                  </div>
                  <Button
                    className="w-full mt-4"
                    onClick={() => onNavigateToDashboard(dashboard.dashboard_id)}
                  >
                    Acessar Dashboard
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Insights Overview */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Insights em Destaque</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InsightSummaryCard
            severity="critical"
            count={insights.critical.length}
            title="Insights Críticos"
            icon={AlertTriangle}
          />
          <InsightSummaryCard
            severity="warning"
            count={insights.warning.length}
            title="Insights de Alerta"
            icon={AlertTriangle}
          />
          <InsightSummaryCard
            severity="info"
            count={insights.info.length}
            title="Informações Relevantes"
            icon={Lightbulb}
          />
        </div>
      </div>
    </div>
  );
};
