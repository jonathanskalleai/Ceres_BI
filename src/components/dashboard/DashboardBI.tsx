// components/dashboard/DashboardBI.tsx - Componentes do Dashboard BI

import { useState } from 'react';
import { Database } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Insight, DashboardDefinition, KPISuggestion } from '@/types/insights';

// DashboardBI Component
export const DashboardBI = ({
  dashboards,
  insights,
  currentView,
  onNavigate,
  filters,
  onFiltersChange
}: {
  dashboards: DashboardDefinition[];
  insights: Insight[];
  currentView: string;
  onNavigate: (view: string) => void;
  filters: any;
  onFiltersChange: (filters: any) => void;
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard BI</h1>
          <p className="text-muted-foreground">
            Análise inteligente de dados por agentes para insights de gestão
          </p>
        </div>
        <Button>Atualizar Dados</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dashboards</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboards.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">KPIs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboards.reduce((acc, d) => acc + d.kpis.length, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="dashboards">Dashboards</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="explorer">Explorador</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <DashboardOverview dashboards={dashboards} insights={insights} />
        </TabsContent>

        <TabsContent value="dashboards">
          <DashboardList dashboards={dashboards} onNavigate={onNavigate} />
        </TabsContent>

        <TabsContent value="insights">
          <InsightList insights={insights} onNavigate={onNavigate} />
        </TabsContent>

        <TabsContent value="explorer">
          <ViewExplorerIntegration />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Dashboard Overview Component
const DashboardOverview = ({
  dashboards,
  insights
}: {
  dashboards: DashboardDefinition[];
  insights: Insight[];
}) => {
  const insightsByCategory = insights.reduce((acc, insight) => {
    acc[insight.category] = (acc[insight.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Categories */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(insightsByCategory).map(([category, count]) => (
          <Card key={category}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{category}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Dashboard Cards */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Dashboards Ativos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dashboards.slice(0, 6).map((dashboard) => (
            <Card key={dashboard.dashboard_id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{dashboard.title}</CardTitle>
                  <Badge variant="secondary">{dashboard.category}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {dashboard.description}
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{dashboard.kpis.length} KPIs</span>
                  <span>•</span>
                  <span>{dashboard.charts_schema.length} gráficos</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

// Dashboard List Component
const DashboardList = ({
  dashboards,
  onNavigate
}: {
  dashboards: DashboardDefinition[];
  onNavigate: (view: string) => void;
}) => {
  const categories = Array.from(new Set(dashboards.map(d => d.category)));

  return (
    <div className="space-y-4">
      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((category) => (
          <Button key={category} variant="outline" size="sm">
            {category}
          </Button>
        ))}
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dashboards.map((dashboard) => (
          <Card key={dashboard.dashboard_id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{dashboard.title}</CardTitle>
                <Badge variant="secondary">{dashboard.category}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {dashboard.description}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{dashboard.kpis.length} KPIs</span>
                  <span>•</span>
                  <span>{dashboard.charts_schema.length} gráficos</span>
                </div>
                <Button
                  className="w-full"
                  onClick={() => onNavigate(dashboard.dashboard_id)}
                >
                  Acessar Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// Dashboard Navigation Component
export const DashboardNavigation = ({
  dashboards,
  currentView,
  onNavigate,
  filters,
  onFiltersChange,
  cidades,
  tiposAcao,
  lastUpdated
}: {
  dashboards: DashboardDefinition[];
  currentView: string;
  onNavigate: (view: string) => void;
  filters: any;
  onFiltersChange: (filters: any) => void;
  cidades?: string[];
  tiposAcao?: string[];
  lastUpdated?: Date;
}) => {
  const categories = Array.from(new Set(dashboards.map(d => d.category)));

  return (
    <div className="w-64 border-r border-border p-4 space-y-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Navigation</h2>
        <div className="space-y-1">
          {categories.map((category) => (
            <Button
              key={category}
              variant={currentView === category ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start"
              onClick={() => onNavigate(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Filters</h3>
        <div className="space-y-2">
          <select
            className="w-full p-2 border border-border rounded text-sm"
            value={filters.cidade || ''}
            onChange={(e) => onFiltersChange({ ...filters, cidade: e.target.value })}
          >
            <option value="">Cidade</option>
            {cidades?.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            className="w-full p-2 border border-border rounded text-sm"
            value={filters.tipoAcao || ''}
            onChange={(e) => onFiltersChange({ ...filters, tipoAcao: e.target.value })}
          >
            <option value="">Tipo Ação</option>
            {tiposAcao?.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Last Updated */}
      {lastUpdated && (
        <div className="text-xs text-muted-foreground">
          Última atualização: {lastUpdated.toLocaleString()}
        </div>
      )}
    </div>
  );
};

// Insight List Component
export const InsightList = ({
  insights,
  onNavigate
}: {
  insights: Insight[];
  onNavigate: (view: string) => void;
}) => {
  const severityColors = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200'
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {insights.map((insight) => (
          <Card key={insight.insight_id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{insight.title}</CardTitle>
                <Badge
                  className={`border-l-4 ${severityColors[insight.severity]}`}
                >
                  {insight.severity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {insight.description}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {insight.metric_value && (
                  <div className="flex items-center justify-between text-sm">
                    <span>Métrica:</span>
                    <span className="font-medium">{insight.metric_value}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span>Fonte:</span>
                  <span className="text-muted-foreground">{insight.data_source}</span>
                </div>
                {insight.recommendation && (
                  <p className="text-xs text-muted-foreground">
                    {insight.recommendation}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// Insight Cards Component
export const InsightCards = ({
  insights,
  onNavigateToInsight
}: {
  insights: Insight[];
  onNavigateToInsight: (insightId: string) => void;
}) => {
  const severityColors = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200'
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Badge variant="outline">Total: {insights.length}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {insights.map((insight) => (
          <Card key={insight.insight_id} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onNavigateToInsight(insight.insight_id)}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{insight.title}</CardTitle>
                <Badge
                  className={`border-l-4 ${severityColors[insight.severity]}`}
                >
                  {insight.severity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {insight.description}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {insight.metric_value && (
                  <div className="flex items-center justify-between text-sm">
                    <span>Métrica:</span>
                    <span className="font-medium">{insight.metric_value}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span>Fonte:</span>
                  <span className="text-muted-foreground">{insight.data_source}</span>
                </div>
                {insight.recommendation && (
                  <p className="text-xs text-muted-foreground">
                    {insight.recommendation}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// KPI Cards Component
export const KPICards = ({
  kpis
}: {
  kpis: KPISuggestion[];
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.kpi_id}>
            <CardHeader>
              <CardTitle className="text-base">{kpi.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {kpi.description}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Fórmula:</span>
                  <code className="ml-1 text-xs bg-muted px-1 rounded">
                    {kpi.metric_formula}
                  </code>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Agregação:</span>
                  <span className="font-medium">{kpi.metric_aggregation}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Fonte:</span>
                  <span className="text-muted-foreground">{kpi.data_source}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// View Explorer Integration Component
export const ViewExplorerIntegration = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Explorador de Views BI</h2>
            <p className="text-sm text-muted-foreground">
              Explore 40 views do SQL Server com insights contextualizados
            </p>
          </div>
        </div>
      </div>

      <ViewExplorerBI />
    </div>
  );
};

// View Explorer BI Component
const ViewExplorerBI = () => {
  const [selectedView, setSelectedView] = useState<string>('');
  const [viewData, setViewData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const VIEWS = [
    "VW_Ceres_Empresas",
    "VW_Ceres_Usuario",
    "VW_Ceres_UsuarioXEmpresa",
    "VW_Ceres_CRM_Acoes",
    "VW_Ceres_CRM_CarteiraClientes",
    "VW_Ceres_CRM_ClienteContatos",
    "VW_Ceres_CRM_ClienteParqueMaquinas",
    "VW_Ceres_CRM_ClientePropriedade",
    "VW_Ceres_CRM_Negocios",
    "VW_Ceres_CRM_Negocios_Etapas",
    "VW_Ceres_CRM_FunilEtapa",
    "VW_Ceres_CRM_Pedidos",
    "VW_Ceres_CRM_PedidosItem",
    "VW_Ceres_CRM_PedidosUsado",
    "VW_Ceres_CRM_EstoqueVirtual",
    "VW_Ceres_CRM_TAGXACAO",
    "VW_Ceres_CRM_TAGXCLIENTE",
    "VW_Ceres_CRM_TAGXNEGOCIO",
    "VW_Ceres_CRM_TAGXPEDIDO",
    "VW_Ceres_Produtos",
    "VW_Ceres_ProdutosGrupo",
    "VW_Ceres_ProdutosMarca",
    "VW_Ceres_ProdutosModelo",
    "VW_Ceres_Agenda",
    "VW_Ceres_OrdemServico",
    "VW_Ceres_Ocorrencias",
    "VW_Ceres_AtendimentoOS",
    "VW_Ceres_AtividadeExtra",
    "VW_Ceres_TecnicoTempo",
  ];

  const handleViewSelect = async (view: string) => {
    setSelectedView(view);
    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setViewData({
        columns: ['id', 'name', 'value'],
        sampleData: [
          { id: 1, name: 'Sample 1', value: 100 },
          { id: 2, name: 'Sample 2', value: 200 }
        ]
      });
    } catch (error) {
      console.error('Error fetching view data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <select
          className="flex-1 p-2 border border-border rounded"
          value={selectedView}
          onChange={(e) => handleViewSelect(e.target.value)}
        >
          <option value="">Selecione uma view...</option>
          {VIEWS.map((view) => (
            <option key={view} value={view}>{view}</option>
          ))}
        </select>

        {selectedView && (
          <Button variant="outline">
            Analisar View
          </Button>
        )}
      </div>

      {selectedView && isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      )}

      {selectedView && viewData && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold">{selectedView}</h3>
            <p className="text-sm text-muted-foreground">
              {viewData.columns.length} colunas, {viewData.sampleData.length} registros amostra
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {viewData.columns.map((col: string) => (
                    <th key={col} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {viewData.sampleData.map((row: any, idx: number) => (
                  <tr key={idx} className="border-b border-border hover:bg-muted/30">
                    {viewData.columns.map((col: string) => (
                      <td key={col} className="px-3 py-2 text-xs">
                        {row[col]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedView && !viewData && !isLoading && (
        <div className="flex items-center justify-center h-32 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground">
            Clique em "Analisar View" para gerar insights
          </p>
        </div>
      )}
    </div>
  );
};

// Analysis Status Component
export const AnalysisStatus = ({
  health,
  analysisStatus
}: {
  health: any;
  analysisStatus: any;
}) => {
  if (!health || !analysisStatus) {
    return <p className="text-muted-foreground">Carregando status...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="text-sm">Total Dashboards</CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.dashboards_count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="text-sm">Total Insights</CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.total_insights}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="text-sm">Relevant Insights</CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.relevant_insights}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="text-sm">Analyses Status</CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {analysisStatus.view_analysis === 'completed' &&
                 analysisStatus.business_context === 'completed' &&
                 analysisStatus.insights_generation === 'completed'
                ? 'Completed'
                : 'In Progress'}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">Agent Status</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">View Analyzer</span>
            <Badge variant={analysisStatus.view_analysis === 'completed' ? 'default' : 'secondary'}>
              {analysisStatus.view_analysis}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Business Context</span>
            <Badge variant={analysisStatus.business_context === 'completed' ? 'default' : 'secondary'}>
              {analysisStatus.business_context}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Insight Generator</span>
            <Badge variant={analysisStatus.insights_generation === 'completed' ? 'default' : 'secondary'}>
              {analysisStatus.insights_generation}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
};