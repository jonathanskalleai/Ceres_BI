// DashboardOverview - Vista geral com VouxBI Design System

import {
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  Target,
  Database,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { VouxKpiCard } from '@/components/ui/voux-kpi-card';
import { ChartCard } from '@/components/ui/voux-chart-card';
import type { DashboardDefinition, Insight } from '@/types/insights';
import type { HealthCheckData, AgentAnalysisStatusData } from './types';
import { AnalysisStatusBadge } from './AnalysisStatusBadge';

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
  const totalInsights = insights
    ? insights.critical.length + insights.warning.length + insights.info.length
    : 0;

  return (
    <div className="p-6 space-y-6" style={{ fontFamily: 'var(--voux-font-sans)' }}>
      {/* Page Header — Design System pattern */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.1em]" style={{ color: 'var(--voux-text-faint)' }}>
            Inteligência · Visão Geral
          </p>
          <h1 className="mt-1 text-2xl font-semibold" style={{ color: 'var(--voux-text-heading)' }}>
            Dashboard BI
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <AnalysisStatusBadge analysisStatus={analysisStatus} />
        </div>
      </div>

      {/* KPI Cards — VouxKpiCard grid */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <VouxKpiCard
          label="Dashboards Ativos"
          value={dashboards.length}
          scope="Categorias de negócio"
          tone="default"
        />
        <VouxKpiCard
          label="Insights Ativos"
          value={totalInsights}
          scope="Relevantes para análise"
          tone="success"
        />
        <VouxKpiCard
          label="Criticidade"
          value={insights.critical.length}
          scope="Insights críticos"
          tone="danger"
        />
      </section>

      {/* Dashboard Grid — ChartCard containers */}
      <div className="space-y-4">
        <div className="mb-4">
          <div className="text-xs font-mono font-semibold tracking-[0.08em] uppercase" style={{ color: 'var(--voux-text-muted)' }}>
            Navegação · Dashboards
          </div>
          <h3 className="text-2xl font-semibold leading-tight" style={{ color: 'var(--voux-text-heading)' }}>
            Dashboards Estratégicos
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <ChartCard key={i}>
                <Skeleton className="h-4 w-3/4 mb-3 bg-[var(--voux-skeleton)]" />
                <Skeleton className="h-20 w-full bg-[var(--voux-skeleton)]" />
              </ChartCard>
            ))
          ) : (
            dashboards.map((dashboard) => (
              <ChartCard key={dashboard.dashboard_id} className="cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_-4px_rgba(212,184,150,0.20)]">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h4 className="text-base font-semibold leading-tight" style={{ color: 'var(--voux-text-primary)' }}>
                      {dashboard.title}
                    </h4>
                    <p className="text-xs mt-1" style={{ color: 'var(--voux-text-muted)' }}>
                      {dashboard.description}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px] font-mono uppercase tracking-wider">
                    {dashboard.category}
                  </Badge>
                </div>

                <div className="space-y-2 mt-auto">
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--voux-text-faint)' }}>
                    <Database className="h-3.5 w-3.5" />
                    <span className="font-mono">{dashboard.kpis.length} KPIs</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--voux-text-faint)' }}>
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="font-mono">{dashboard.charts_schema.length} gráficos</span>
                  </div>
                </div>

                <Button
                  className="w-full mt-4"
                  size="sm"
                  onClick={() => onNavigateToDashboard(dashboard.dashboard_id)}
                >
                  Acessar Dashboard
                </Button>
              </ChartCard>
            ))
          )}
        </div>
      </div>

      {/* Insights Overview — VouxKpiCard com tone por severidade */}
      <div className="space-y-4">
        <div className="mb-4">
          <div className="text-xs font-mono font-semibold tracking-[0.08em] uppercase" style={{ color: 'var(--voux-text-muted)' }}>
            Monitoramento · Alertas
          </div>
          <h3 className="text-2xl font-semibold leading-tight" style={{ color: 'var(--voux-text-heading)' }}>
            Insights em Destaque
          </h3>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <VouxKpiCard
            label="Insights Críticos"
            value={insights.critical.length}
            scope="Atenção imediata"
            tone="danger"
          />
          <VouxKpiCard
            label="Insights de Alerta"
            value={insights.warning.length}
            scope="Acompanhamento"
            tone="warning"
          />
          <VouxKpiCard
            label="Informações"
            value={insights.info.length}
            scope="Oportunidades"
            tone="success"
          />
        </section>
      </div>
    </div>
  );
};
