# Arquitetura do Dashboard BI com Análise por Agentes

## 1. Visão Geral

Implementação de uma nova aba "BI" no dashboard Ceres BI que utiliza análise inteligente por agentes para gerar insights de gestão automatizados a partir de todas as 40 views do SQL Server.

## 2. Arquitetura do Sistema

### 2.1 Estrutura de Dados e Armazenamento

#### 2.1.1 Tabela de Insights (schema: insights)

```sql
CREATE TABLE insights.insights (
    insight_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'critical', 'warning', 'info'
    metric_type VARCHAR(100) NOT NULL,
    metric_value DECIMAL(18,2),
    metric_comparison VARCHAR(20), -- 'growth', 'decline', 'stable'
    metric_percentage DECIMAL(5,2),
    data_source VARCHAR(100) NOT NULL, -- nome da view
    dashboard_id VARCHAR(100) NOT NULL,
    sql_query TEXT,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    applied_filters JSONB,
    linked_entities JSONB,
    kpi_references JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    is_relevant BOOLEAN DEFAULT TRUE,
    recommendation TEXT,
    created_by VARCHAR(100) DEFAULT 'ai-agent'
);

CREATE INDEX idx_insights_category ON insights.insights(category);
CREATE INDEX idx_insights_severity ON insights.insights(severity);
CREATE INDEX idx_insights_dashboard ON insights.insights(dashboard_id);
CREATE INDEX idx_insights_generated_at ON insights.insights(generated_at DESC);
CREATE INDEX idx_insights_active ON insights.insights(is_active, is_relevant);
```

#### 2.1.2 Tabela de Dashboards Definidos (schema: insights)

```sql
CREATE TABLE insights.dashboard_definitions (
    dashboard_id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    category VARCHAR(100) NOT NULL,
    kpis JSONB NOT NULL,
    charts_schema JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_analyzed TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_dashboard_definitions_category ON insights.dashboard_definitions(category);
```

#### 2.1.3 Tabela de KPIs Sugeridos (schema: insights)

```sql
CREATE TABLE insights.kpi_definitions (
    kpi_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id VARCHAR(100) NOT NULL REFERENCES insights.dashboard_definitions(dashboard_id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metric_formula TEXT NOT NULL,
    metric_aggregation VARCHAR(50), -- 'sum', 'avg', 'count', 'percentage'
    metric_column VARCHAR(255) NOT NULL,
    dimension_column VARCHAR(255),
    dimension_grouping VARCHAR(100), -- 'daily', 'weekly', 'monthly', 'by_city', 'by_region'
    data_source VARCHAR(100) NOT NULL,
    data_source_view VARCHAR(255),
    priority INTEGER DEFAULT 5,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_kpi_definitions_dashboard ON insights.kpi_definitions(dashboard_id);
CREATE INDEX idx_kpi_definitions_active ON insights.kpi_definitions(is_active);
```

#### 2.1.4 Tabela de Relações entre Views (schema: insights)

```sql
CREATE TABLE insights.view_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_view VARCHAR(255) NOT NULL,
    target_view VARCHAR(255) NOT NULL,
    relationship_type VARCHAR(100) NOT NULL, -- 'has', 'related_to', 'joins', 'derives_from'
    relationship_strength DECIMAL(3,2) DEFAULT 0.5,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_view_relationships_source ON insights.view_relationships(source_view);
CREATE INDEX idx_view_relationships_target ON insights.view_relationships(target_view);
CREATE INDEX idx_view_relationships_type ON insights.view_relationships(relationship_type);
```

### 2.2 Fluxo de Análise por Agentes

#### 2.2.1 Agente 1: ViewAnalyzerAgent

**Responsabilidade:** Analisa cada uma das 40 views do SQL Server, entende a estrutura dos dados, identifica colunas relevantes e categorias de negócio.

**Comandos do Agente:**
- `analyze-view` - Analisa uma view específica
- `get-view-structure` - Retorna estrutura e metadados da view
- `categorize-columns` - Categoriza colunas por tipo de dado e significado

**Fluxo de Execução:**
1. Itera sobre todas as 40 views
2. Para cada view:
   - Executa `analyze-view`
   - Extrai metadados: colunas, tipos, comentários
   - Identifica colunas numéricas, datas, texto
   - Sugere categorias de negócio (CRM, vendas, estoque, etc.)

**Output Armazenado:**
- Metadados de cada view (cols: ViewMetadata[])
- Relações entre views (cols: ViewRelationship[])

#### 2.2.2 Agente 2: BusinessContextAgent

**Responsabilidade:** Entende o contexto de negócio da empresa a partir dos dados e identifica oportunidades de KPIs e dashboards.

**Comandos do Agente:**
- `analyze-business-context` - Analisa todo o contexto de negócio
- `identify-kpi-opportunities` - Sugere KPIs potenciais
- `suggest-charts` - Sugere tipos de gráficos para cada KPI

**Fluxo de Execução:**
1. Analisa resultados do ViewAnalyzerAgent
2. Combina com conhecimento de negócios de CRM Comercial, Funil de Vendas, Pós-Venda
3. Identifica padrões e tendências nos dados
4. Sugere KPIs estratégicos e não estrategicos

**Output Armazenado:**
- Lista de KPIs sugeridos (cols: KPISuggestion[])
- Tipos de gráficos sugeridos (cols: ChartTypeSuggestion[])

#### 2.2.3 Agente 3: InsightGeneratorAgent

**Responsabilidade:** Gera insights inteligentes e relevantes a partir dos dados analisados.

**Comandos do Agente:**
- `generate-insights` - Gera insights para uma categoria ou dashboard
- `compare-periods` - Compara períodos para identificar tendências
- `detect-anomalies` - Detecta anomalias nos dados

**Fluxo de Execução:**
1. Recebe KPIs sugeridos pelo BusinessContextAgent
2. Para cada KPI:
   - Executa queries nos dados
   - Compara períodos (mês atual vs mês anterior, ano atual vs ano anterior)
   - Identifica crescimento, queda, estabilidade
   - Gera insights com nível de severidade

**Output Armazenado:**
- Insights gerados (cols: Insight[])
- Métricas comparativas (cols: MetricComparison[])

### 2.3 Estrutura de Dashboards BI

#### 2.3.1 Dashboards Principais (Prioridade Alta)

1. **Dashboard de CRM Comercial**
   - Foco: Vendas, funil, pipelines, relacionamento cliente
   - KPIs: Vendas mensais, taxa de conversão, ticket médio, churn, MRR

2. **Dashboard de Funil de Vendas**
   - Foco: Etapas do funil, velocidade, conversion rates
   - KPIs: Taxa de conversão por etapa, tempo médio por etapa, drop-offs

3. **Dashboard de Pós-Venda e Atendimento**
   - Foco: OS, ocorrencias, suporte técnico
   - KPIs: Tempo medio resolução, SLA compliance, ticket volume

4. **Dashboard de Produtos e Estoque**
   - Foco: Produtos vendidos, estoque, inventário
   - KPIs: Vendas por produto, rotatividade de estoque, SKUs críticos

5. **Dashboard de Equipe e Performance**
   - Foco: Consultores, técnicos, performance por região
   - KPIs: Metas por vendedor, performance por cidade/região, produtividade

6. **Dashboard de Relacionamento Cliente (Cliente 360)**
   - Foco: Histórico completo do cliente
   - KPIs: Lifetime value, ticket médio por cliente, frequência de compras

7. **Dashboard de Oportunidades e Pipeline**
   - Foco: Negócios em andamento, previsão de fechamento
   - KPIs: Vendas previstas, probabilidade de fechamento, valor em pipeline

8. **Dashboard de Agenda e Atividades**
   - Foco: Atividades agendadas, follow-ups
   - KPIs: Atividades completadas, pendentes, taxa de conclusão

9. **Dashboard de Ordens de Serviço**
   - Foco: OS abertas, em andamento, fechadas
   - KPIs: Tempo aberto, tempo de resolução, SLA

10. **Dashboard de Ocorrências e Problemas**
    - Foco: Problemas identificados, ações tomadas
    - KPIs: Problemas por tipo, resolvimento rate, downtime

#### 2.3.2 Dashboards de Navegação

- **Dashboard de Exploração de Views** - Uso do explorador existente como base
- **Dashboard de Relatórios Personalizados** - Permite criar dashboards customizados
- **Dashboard de Comparativos Temporais** - Comparações entre períodos

### 2.4 Integração com Explorador de Views

O Dashboard BI será uma nova aba no Dashboard Ceres que:

1. **Exibe resumo de insights** para cada dashboard
2. **Permite navegação rápida** para os dashboards principais
3. **Integra com o explorador de views** existente:
   - Ao selecionar uma view no explorador, exibe insights relacionados
   - Sugere dashboards que usariam essa view como fonte
   - Mostra KPIs que podem ser calculados a partir da view

### 2.5 Componentes da Interface

#### 2.5.1 Componente DashboardBI (Página Principal)

```typescript
interface DashboardBIProps {
  filters: Filters;
  onFilterChange: (filters: Filters) => void;
}

// Visualização:
// - Sidebar com lista de dashboards (categorizados)
// - Área principal com insights em destaque
// - Cards de KPIs principais
// - Navegação para dashboards específicos
```

#### 2.5.2 Componente InsightCard

```typescript
interface InsightCardProps {
  insight: Insight;
  onDismiss?: () => void;
  onExpand?: () => void;
}

// Visualização:
// - Título e descrição
// - Métrica principal com valor e comparação
// - Nível de severidade (badge colorido)
// - Link para dashboard relacionado
// - Ações: dismiss, expandir, investigar
```

#### 2.5.3 Componente KPICard

```typescript
interface KPICardProps {
  kpi: KPISuggestion;
  currentData?: any;
  onNavigateToDashboard?: () => void;
}

// Visualização:
// - Valor atual
// - Comparação com período anterior
// - Gráfico de tendência (mini)
// - Link para dashboard
```

#### 2.5.4 Componente DashboardNavigation

```typescript
interface DashboardNavigationProps {
  currentView: string;
  onNavigate: (view: string) => void;
  dashboards: DashboardDefinition[];
}

// Visualização:
// - Lista de dashboards com ícones
// - Badge com número de insights relevantes
// - Busca e filtro
// - Categorias
```

### 2.6 Integração com Serviços de Dados

#### 2.6.1 SQL Server API Service

```typescript
// service/sqlServerApi.ts
export const querySqlServer = async ({
  view,
  columns,
  filters,
  groupBy,
  orderBy,
  limit,
  offset,
  count_only
}: QueryRequest): Promise<QueryResponse> => {
  // Query com parâmetros seguros
  // Returns: { data: any[], total?: number, columns: string[] }
};
```

#### 2.6.2 Insights Service

```typescript
// service/insightsService.ts
export const insightsService = {
  // Dashboard
  getDashboardDefinitions: () => Promise<DashboardDefinition[]>,
  getDashboardById: (id: string) => Promise<DashboardDefinition>,

  // KPIs
  getKPISuggestions: (dashboardId?: string) => Promise<KPISuggestion[]>,
  getKPIById: (id: string) => Promise<KPISuggestion>,

  // Insights
  getInsights: (filters?: InsightFilters) => Promise<Insight[]>,

  // Relationship
  getViewRelationships: () => Promise<ViewRelationship[]>,

  // Metrics
  getMetricComparison: (kpiId: string, period: string) => Promise<MetricComparison>,
};
```

#### 2.6.3 Agent Analysis Service

```typescript
// service/agentAnalysisService.ts
export const agentAnalysisService = {
  // Agent 1: ViewAnalyzer
  analyzeView: (viewName: string) => Promise<ViewMetadata>,
  analyzeAllViews: () => Promise<ViewMetadata[]>,

  // Agent 2: BusinessContext
  analyzeBusinessContext: () => Promise<BusinessContext>,

  // Agent 3: InsightGenerator
  generateInsights: (dashboardId?: string) => Promise<Insight[]>,

  // Workflow completo
  runFullAnalysis: () => Promise<AnalysisResult>,
};
```

### 2.7 Types TypeScript

```typescript
// types/insights.ts

export type Severity = 'critical' | 'warning' | 'info';

export interface Insight {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: Severity;
  metric_type: string;
  metric_value?: number;
  metric_comparison?: 'growth' | 'decline' | 'stable';
  metric_percentage?: number;
  data_source: string;
  dashboard_id: string;
  sql_query: string;
  generated_at: Date;
  applied_filters: Record<string, any>;
  linked_entities: Record<string, any>;
  kpi_references: Record<string, any>;
  recommendation?: string;
}

export interface ViewMetadata {
  view_name: string;
  table_name: string;
  column_count: number;
  columns: ColumnMetadata[];
  description?: string;
  business_category?: string;
  data_type_distribution: Record<string, number>;
}

export interface ColumnMetadata {
  name: string;
  type: string;
  is_numeric: boolean;
  is_date: boolean;
  is_text: boolean;
  is_foreign_key: boolean;
  is_primary_key: boolean;
  nullable: boolean;
  description?: string;
  sample_values?: any[];
}

export interface DashboardDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  kpis: KPISuggestion[];
  charts_schema: ChartType[];
  last_analyzed?: Date;
  is_active: boolean;
}

export interface KPISuggestion {
  id: string;
  dashboard_id: string;
  title: string;
  description?: string;
  metric_formula: string;
  metric_aggregation: 'sum' | 'avg' | 'count' | 'percentage';
  metric_column: string;
  dimension_column?: string;
  dimension_grouping?: string;
  data_source: string;
  data_source_view?: string;
  priority: number;
  is_active: boolean;
  chart_type: ChartType;
}

export interface ChartType {
  type: 'bar' | 'line' | 'pie' | 'table' | 'combo';
  options: Record<string, any>;
  color_scheme?: string;
}

export interface ViewRelationship {
  source_view: string;
  target_view: string;
  relationship_type: string;
  relationship_strength: number;
  description?: string;
}

export interface MetricComparison {
  kpi_id: string;
  current_value: number;
  previous_value: number;
  period_comparison: 'same_month_last_year' | 'same_period_last_year' | 'previous_month' | 'previous_period';
  percentage_change: number;
  is_growth: boolean;
  trend: 'up' | 'down' | 'stable';
}
```

## 3. Fluxo de Implementação

### Fase 1: Database Setup
1. Criar esquema de insights no banco
2. Migrar dashboards prioritários
3. Popular com dados de exemplo

### Fase 2: Agentes de Análise
1. Implementar ViewAnalyzerAgent
2. Implementar BusinessContextAgent
3. Implementar InsightGeneratorAgent

### Fase 3: Interface
1. Criar DashboardBI page
2. Criar componentes de insight e KPI
3. Integrar com DashboardSidebar

### Fase 4: Integração com Views
1. Conectar explorador de views ao sistema de insights
2. Adicionar navegação contextual
3. Implementar filtros inteligentes

### Fase 5: Testing e Otimização
1. Testar fluxo completo de análise
2. Otimizar performance das queries
3. Ajustar qualidade dos insights

## 4. Recursos Futuros

- Análise preditiva (ML)
- Dashboards personalizados por usuário
- Alertas automatizados
- Exportação de insights
- Integração com outros sistemas
- API para externalização
