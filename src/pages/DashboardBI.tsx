// pages/DashboardBI.tsx - Página principal do Dashboard BI com Análise por Agentes

import { useState, useMemo } from 'react';
import {
  RefreshCw,
  Loader2,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  TrendingUp,
  Target,
  Database
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Skeleton
} from '@/components/ui/skeleton';
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
  KPICards,
  InsightCards,
  AnalysisStatus
} from '@/components/dashboard/DashboardBI';
import { useToast } from '@/hooks/use-toast';
import {
  Insight,
  DashboardDefinition,
  InsightFilters,
  Severity
} from '@/types/insights';

const DashboardBI = () => {
  const { toast } = useToast();
  const {
    navigateToDashboard,
    navigateToInsight,
    navigateBack,
    currentDashboard,
    currentInsight,
    resetNavigation
  } = useDashboardNavigation();

  const { filters, updateFilters, clearFilters } = useInsightFilters();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data queries
  const { data: dashboards, isLoading: dashboardsLoading } = useDashboards();
  const { data: insights, isLoading: insightsLoading } = useInsights(filters);
  const { data: health } = useHealthCheck();
  const { data: analysisStatus } = useAgentAnalysisStatus();

  // Filter handlers
  const handleFilterChange = (key: keyof InsightFilters, value: any) => {
    updateFilters({ [key]: value });
  };

  const handleClearFilters = () => {
    clearFilters();
  };

  const handleSync = async () => {
    setIsRefreshing(true);
    toast({ title: "Atualizando dados...", description: "Sincronizando insights com o SQL Server." });

    // Implement sync logic here
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate sync

    setIsRefreshing(false);
    toast({ title: "Dados atualizados", description: "Todos os insights foram recalculados." });
  };

  // Filter insights by severity
  const insightsBySeverity = useMemo(() => {
    if (!insights) return { critical: [], warning: [], info: [] };

    return {
      critical: insights.filter(i => i.severity === 'critical'),
      warning: insights.filter(i => i.severity === 'warning'),
      info: insights.filter(i => i.severity === 'info')
    };
  }, [insights]);

  // Get dashboard by current view
  const currentDashboardData = useMemo(() => {
    if (!currentDashboard || !dashboards) return null;
    return dashboards.find(d => d.dashboard_id === currentDashboard);
  }, [currentDashboard, dashboards]);

  // Loading states
  const isLoading = dashboardsLoading || insightsLoading;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <DashboardNavigation
        dashboards={dashboards || []}
        currentView={currentDashboard || 'overview'}
        onNavigate={(dashboardId) => navigateToDashboard(dashboardId)}
        filters={filters}
        onFiltersChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        hasActiveFilters={Object.keys(filters).length > 0}
      />

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="flex justify-end p-3 pb-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isRefreshing}
            className="gap-2 text-xs"
          >
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

        {/* Content */}
        {currentInsight ? (
          // Show individual insight
          <InsightDetail insight={currentDashboardData} />
        ) : currentDashboard ? (
          // Show specific dashboard
          <DashboardSpecificView
            dashboard={currentDashboardData}
            insights={insightsBySeverity}
            onNavigateToInsight={navigateToInsight}
            onNavigateBack={navigateBack}
          />
        ) : (
          // Show overview (default)
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

// Dashboard Overview Component
const DashboardOverview = ({
  dashboards,
  insights,
  health,
  analysisStatus,
  onNavigateToDashboard
}: {
  dashboards: DashboardDefinition[];
  insights: { critical: Insight[], warning: Insight[], info: Insight[] };
  health: any;
  analysisStatus: any;
  onNavigateToDashboard: (dashboardId: string) => void;
}) => {
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
            <p className="text-xs text-muted-foreground">
              Categorias de negócio
            </p>
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
            <p className="text-xs text-muted-foreground">
              Relevantes para análise
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Criticidade</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{insights.critical.length}</div>
            <p className="text-xs text-muted-foreground">
              Insights críticos
            </p>
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
            // Loading state
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

// Insight Summary Card Component
const InsightSummaryCard = ({
  severity,
  count,
  title,
  icon: Icon
}: {
  severity: Severity;
  count: number;
  title: string;
  icon: any;
}) => {
  const getSeverityColor = () => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card className={`border-l-4 ${getSeverityColor().split(' ')[2]}`}>
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <Icon className="h-6 w-6" />
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-3xl font-bold mt-1">{count}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Analysis Status Component
const AnalysisStatusBadge = ({ analysisStatus }: { analysisStatus: any }) => {
  if (!analysisStatus) return null;

  const getStatusColor = () => {
    if (analysisStatus.view_analysis === 'completed' &&
        analysisStatus.business_context === 'completed' &&
        analysisStatus.insights_generation === 'completed') {
      return 'bg-green-100 text-green-800';
    } else if (analysisStatus.view_analysis === 'in_progress' ||
               analysisStatus.business_context === 'in_progress' ||
               analysisStatus.insights_generation === 'in_progress') {
      return 'bg-yellow-100 text-yellow-800';
    } else {
      return 'bg-red-100 text-red-800';
    }
  };

  const getStatusText = () => {
    if (analysisStatus.view_analysis === 'completed' &&
        analysisStatus.business_context === 'completed' &&
        analysisStatus.insights_generation === 'completed') {
      return 'Analisado';
    } else if (analysisStatus.view_analysis === 'in_progress' ||
               analysisStatus.business_context === 'in_progress' ||
               analysisStatus.insights_generation === 'in_progress') {
      return 'Analisando...';
    } else {
      return 'Necessário Análise';
    }
  };

  return (
    <Badge className={getStatusColor()}>
      {getStatusText()}
    </Badge>
  );
};

// Dashboard Specific View Component
const DashboardSpecificView = ({
  dashboard,
  insights,
  onNavigateToInsight,
  onNavigateBack
}: {
  dashboard: DashboardDefinition | null;
  insights: { critical: Insight[], warning: Insight[], info: Insight[] };
  onNavigateToInsight: (insightId: string) => void;
  onNavigateBack: () => void;
}) => {
  if (!dashboard) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground">Dashboard não encontrado</p>
          <Button onClick={onNavigateBack}>Voltar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onNavigateBack}>
          ← Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{dashboard.title}</h1>
          <p className="text-muted-foreground">{dashboard.description}</p>
        </div>
        <Badge variant="secondary">{dashboard.category}</Badge>
      </div>

      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="kpis">KPIs</TabsTrigger>
          <TabsTrigger value="charts">Gráficos</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-4">
          <InsightCards
            insights={[...insights.critical, ...insights.warning, ...insights.info]}
            onNavigateToInsight={onNavigateToInsight}
          />
        </TabsContent>

        <TabsContent value="kpis" className="space-y-4">
          <KPICards kpis={dashboard.kpis} />
        </TabsContent>

        <TabsContent value="charts" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dashboard.charts_schema.map((chart, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle>Gráfico {index + 1}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Tipo: {chart.type}
                  </p>
                  <div className="mt-4 h-48 bg-muted rounded flex items-center justify-center">
                    <p className="text-muted-foreground">
                      Visualização do gráfico {chart.type}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Insight Detail Component (placeholder)
const InsightDetail = ({ insight }: { insight: any }) => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Detalhe do Insight</h1>
      <p className="text-muted-foreground">Detalhes do insight selecionado</p>
    </div>
  );
};

export default DashboardBI;