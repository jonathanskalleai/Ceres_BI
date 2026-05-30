-- Migration: 20260529140117_create_schema_insights
-- Criação do schema 'insights' para armazenamento de dados de inteligência de negócio

-- Criar schema insights
CREATE SCHEMA IF NOT EXISTS insights;

-- Tabela: dashboards - Definições de dashboards estratégicos
CREATE TABLE IF NOT EXISTS insights.dashboards (
    dashboard_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    category VARCHAR(100) NOT NULL CHECK (category IN ('crm-comercial', 'funil-vendas', 'pos-venda', 'produtos', 'equipe', 'cliente-360', 'pipeline', 'agenda', 'ordens-servico', 'ocorrencias', 'financeiro', 'operacoes')),
    kpis JSONB[] DEFAULT '[]'::JSONB[], -- Array de objetos KPI
    charts_schema JSONB[] DEFAULT '[]'::JSONB[], -- Array de objetos de gráficos
    last_analyzed TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: kp_suggestions - Sugestões de KPIs
CREATE TABLE IF NOT EXISTS insights.kpi_suggestions (
    kpi_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID REFERENCES insights.dashboards(dashboard_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metric_formula TEXT NOT NULL,
    metric_aggregation VARCHAR(50) NOT NULL CHECK (metric_aggregation IN ('sum', 'avg', 'count', 'percentage', 'max', 'min')),
    metric_column VARCHAR(100) NOT NULL,
    dimension_column VARCHAR(100),
    dimension_grouping VARCHAR(100),
    data_source VARCHAR(100) NOT NULL,
    data_source_view VARCHAR(100),
    priority INTEGER DEFAULT 1 CHECK (priority >= 1),
    is_active BOOLEAN DEFAULT true,
    chart_type VARCHAR(50) NOT NULL CHECK (chart_type IN ('bar', 'line', 'pie', 'table', 'combo', 'area', 'scatter')),
    color_scheme VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: insights - Insights gerados pelos agentes
CREATE TABLE IF NOT EXISTS insights.insights (
    insight_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
    metric_type VARCHAR(100),
    metric_value NUMERIC,
    metric_comparison VARCHAR(20) CHECK (metric_comparison IN ('growth', 'decline', 'stable')),
    metric_percentage NUMERIC,
    data_source VARCHAR(100) NOT NULL,
    dashboard_id UUID REFERENCES insights.dashboards(dashboard_id) ON DELETE CASCADE,
    sql_query TEXT,
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    applied_filters JSONB,
    linked_entities JSONB,
    kpi_references JSONB,
    recommendation TEXT,
    is_active BOOLEAN DEFAULT true,
    is_relevant BOOLEAN DEFAULT true,
    business_impact VARCHAR(20) CHECK (business_impact IN ('high', 'medium', 'low')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: view_metadata - Metadados das views SQL
CREATE TABLE IF NOT EXISTS insights.view_metadata (
    view_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    view_name VARCHAR(100) UNIQUE NOT NULL,
    table_name VARCHAR(100),
    column_count INTEGER,
    columns JSONB NOT NULL,
    description TEXT,
    business_category VARCHAR(100),
    data_type_distribution JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: view_relationships - Relacionamentos entre views
CREATE TABLE IF NOT EXISTS insights.view_relationships (
    relationship_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_view VARCHAR(100) NOT NULL,
    target_view VARCHAR(100) NOT NULL,
    relationship_type VARCHAR(50) NOT NULL,
    relationship_strength NUMERIC CHECK (relationship_strength >= 0 AND relationship_strength <= 1),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    FOREIGN KEY (source_view) REFERENCES insights.view_metadata(view_name) ON DELETE CASCADE,
    FOREIGN KEY (target_view) REFERENCES insights.view_metadata(view_name) ON DELETE CASCADE
);

-- Tabela: business_context - Contexto de negócio
CREATE TABLE IF NOT EXISTS insights.business_context (
    context_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    business_areas JSONB,
    key_performance_indicators TEXT[],
    data_maturity VARCHAR(20) CHECK (data_maturity IN ('basic', 'intermediate', 'advanced')),
    integration_points JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: analysis_history - Histórico de análises
CREATE TABLE IF NOT EXISTS insights.analysis_history (
    analysis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_type VARCHAR(50) NOT NULL CHECK (analysis_type IN ('view_analysis', 'business_context', 'insight_generation', 'dashboard_analysis')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    total_items_processed INTEGER,
    success_rate NUMERIC,
    error_message TEXT,
    parameters JSONB,
    results JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: user_preferences - Preferências de usuário
CREATE TABLE IF NOT EXISTS insights.user_preferences (
    preference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    dashboard_id UUID REFERENCES insights.dashboards(dashboard_id) ON DELETE SET NULL,
    default_dashboard VARCHAR(100),
    favorite_insights UUID[] DEFAULT '{}',
    ignored_insights UUID[] DEFAULT '{}',
    notification_preferences JSONB DEFAULT '{}'::JSONB,
    theme_preferences JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_insights_category_severity ON insights.insights(category, severity);
CREATE INDEX IF NOT EXISTS idx_insights_dashboard_id ON insights.insights(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_insights_generated_at ON insights.insights(generated_at);
CREATE INDEX IF NOT EXISTS idx_insights_business_impact ON insights.insights(business_impact);
CREATE INDEX IF NOT EXISTS idx_insights_is_active ON insights.insights(is_active);
CREATE INDEX IF NOT EXISTS idx_insights_is_relevant ON insights.insights(is_relevant);

CREATE INDEX IF NOT EXISTS idx_kpi_dashboard_id ON insights.kpi_suggestions(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_kpi_priority ON insights.kpi_suggestions(priority);
CREATE INDEX IF NOT EXISTS idx_kpi_is_active ON insights.kpi_suggestions(is_active);

CREATE INDEX IF NOT EXISTS idx_view_metadata_category ON insights.view_metadata(business_category);
CREATE INDEX IF NOT EXISTS idx_view_relationships_source ON insights.view_relationships(source_view);
CREATE INDEX IF NOT EXISTS idx_view_relationships_target ON insights.view_relationships(target_view);

CREATE INDEX IF NOT EXISTS idx_analysis_history_type_status ON insights.analysis_history(analysis_type, status);
CREATE INDEX IF NOT EXISTS idx_analysis_history_created_at ON insights.analysis_history(created_at);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON insights.user_preferences(user_id);

-- Triggers para atualização de timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dashboards_updated_at
    BEFORE UPDATE ON insights.dashboards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kpis_updated_at
    BEFORE UPDATE ON insights.kpi_suggestions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_insights_updated_at
    BEFORE UPDATE ON insights.insights
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_view_metadata_updated_at
    BEFORE UPDATE ON insights.view_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_relationships_updated_at
    BEFORE UPDATE ON insights.view_relationships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_context_updated_at
    BEFORE UPDATE ON insights.business_context
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON insights.user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Políticas de segurança
ALTER SCHEMA insights OWNER TO authenticated;

-- Políticas para dashboards
ALTER TABLE insights.dashboards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read dashboards" ON insights.dashboards FOR SELECT USING (true);
CREATE POLICY "Allow service role write dashboards" ON insights.dashboards FOR ALL TO service_role USING (true);

-- Políticas para kp_suggestions
ALTER TABLE insights.kpi_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read kpi_suggestions" ON insights.kpi_suggestions FOR SELECT USING (true);
CREATE POLICY "Allow service role write kpi_suggestions" ON insights.kpi_suggestions FOR ALL TO service_role USING (true);

-- Políticas para insights
ALTER TABLE insights.insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read insights" ON insights.insights FOR SELECT USING (true);
CREATE POLICY "Allow service role write insights" ON insights.insights FOR ALL TO service_role USING (true);

-- Políticas para view_metadata
ALTER TABLE insights.view_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read view_metadata" ON insights.view_metadata FOR SELECT USING (true);
CREATE POLICY "Allow service role write view_metadata" ON insights.view_metadata FOR ALL TO service_role USING (true);

-- Políticas para view_relationships
ALTER TABLE insights.view_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read view_relationships" ON insights.view_relationships FOR SELECT USING (true);
CREATE POLICY "Allow service role write view_relationships" ON insights.view_relationships FOR ALL TO service_role USING (true);

-- Políticas para business_context
ALTER TABLE insights.business_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read business_context" ON insights.business_context FOR SELECT USING (true);
CREATE POLICY "Allow service role write business_context" ON insights.business_context FOR ALL TO service_role USING (true);

-- Políticas para analysis_history
ALTER TABLE insights.analysis_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read analysis_history" ON insights.analysis_history FOR SELECT USING (true);
CREATE POLICY "Allow service role write analysis_history" ON insights.analysis_history FOR ALL TO service_role USING (true);

-- Políticas para user_preferences
ALTER TABLE insights.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read own preferences" ON insights.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow insert own preferences" ON insights.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow update own preferences" ON insights.user_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Allow delete own preferences" ON insights.user_preferences FOR DELETE USING (auth.uid() = user_id);

-- Função para popular dados iniciais
CREATE OR REPLACE FUNCTION insights.populate_initial_data()
RETURNS VOID AS $$
DECLARE
    company_context_id UUID;
    dashboard_id UUID;
    kpi_id UUID;
BEGIN
    -- Inserir contexto de negócio inicial
    INSERT INTO insights.business_context (
        company_name,
        business_areas,
        key_performance_indicators,
        data_maturity,
        integration_points
    ) VALUES (
        'Ceres Equipamentos',
        '["comercial", "produtos", "servicos", "operacoes"]'::JSONB,
        ARRAY['total_clientes', 'taxa_conversao', 'ticket_medio', 'satisfacao_cliente'],
        'intermediate',
        '["CRM_Pedidos_Produtos", "OS_Tecnicos_Agenda"]'::JSONB
    ) RETURNING context_id INTO company_context_id;

    -- Inserir dashboards iniciais
    INSERT INTO insights.dashboards (
        title,
        description,
        icon,
        category,
        kpis,
        charts_schema
    ) VALUES
        ('Visão Geral Comercial', 'Dashboard principal com indicadores de performance comercial', 'BarChart3', 'crm-comercial',
        '[
            {
                "kpi_id": "kpi_1",
                "title": "Total de Clientes na Carteira",
                "metric_formula": "COUNT(DISTINCT cliente_id)",
                "metric_aggregation": "count",
                "metric_column": "cliente_id",
                "data_source": "VW_Ceres_CRM_CarteiraClientes",
                "chart_type": "bar",
                "priority": 1
            },
            {
                "kpi_id": "kpi_2",
                "title": "Taxa de Conversão",
                "metric_formula": "(COUNT(CASE WHEN etapa_finalizada THEN 1 END) * 100.0 / COUNT(*))",
                "metric_aggregation": "percentage",
                "metric_column": "etapa_id",
                "data_source": "VW_Ceres_CRM_Negocios",
                "chart_type": "line",
                "priority": 2
            }
        ]'::JSONB,
        '[
            {
                "type": "bar",
                "options": {"title": "Clientes por Região"},
                "color_scheme": ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"]
            },
            {
                "type": "line",
                "options": {"title": "Evolução de Negócios"},
                "color_scheme": ["#8b5cf6", "#06b6d4"]
            }
        ]'::JSONB
        ),

        ('Performance de Vendas', 'Análise detalhada de vendas e pipeline', 'TrendingUp', 'funil-vendas',
        '[
            {
                "kpi_id": "kpi_3",
                "title": "Valor Médio do Negócio",
                "metric_formula": "AVG(valor_negocio)",
                "metric_aggregation": "avg",
                "metric_column": "valor_negocio",
                "data_source": "VW_Ceres_CRM_Negocios",
                "chart_type": "table",
                "priority": 1
            }
        ]'::JSONB,
        '[
            {
                "type": "pie",
                "options": {"title": "Distribuição do Funil"},
                "color_scheme": ["#f97316", "#eab308", "#22c55e", "#3b82f6"]
            }
        ]'::JSONB
        ),

        ('Qualidade do Atendimento', 'Monitoramento de pós-venda e qualidade técnica', 'Wrench', 'pos-venda',
        '[
            {
                "kpi_id": "kpi_4",
                "title": "Taxa de Conclusão de Serviços",
                "metric_formula": "(COUNT(CASE WHEN status = ''Concluído'' THEN 1 END) * 100.0 / COUNT(*))",
                "metric_aggregation": "percentage",
                "metric_column": "status",
                "data_source": "VW_Ceres_OrdemServico",
                "chart_type": "bar",
                "priority": 1
            }
        ]'::JSONB,
        '[
            {
                "type": "area",
                "options": {"title": "Volume de Atendimentos"},
                "color_scheme": ["#06b6d4", "#8b5cf6"]
            }
        ]'::JSONB
        ) RETURNING dashboard_id INTO dashboard_id;

    -- Inserir view metadata inicial
    INSERT INTO insights.view_metadata (
        view_name,
        table_name,
        column_count,
        columns,
        description,
        business_category
    ) VALUES
        ('VW_Ceres_CRM_CarteiraClientes', 'carteira_clientes', 15,
        '[
            {"name": "cliente_id", "type": "integer", "is_numeric": true, "is_primary_key": true},
            {"name": "cliente_nome", "type": "varchar", "is_text": true},
            {"name": "cliente_cnpj", "type": "varchar", "is_text": true},
            {"name": "cidade", "type": "varchar", "is_text": true},
            {"name": "regiao", "type": "varchar", "is_text": true},
            {"name": "valor_comercial", "type": "decimal", "is_numeric": true},
            {"name": "data_ultima_visita", "type": "datetime", "is_date": true}
        ]'::JSONB,
        'Clientes ativos na carteira comercial',
        'crm-comercial'
        ),

        ('VW_Ceres_CRM_Negocios', 'negocios', 20,
        '[
            {"name": "negocio_id", "type": "integer", "is_numeric": true, "is_primary_key": true},
            {"name": "cliente_id", "type": "integer", "is_numeric": true},
            {"name": "valor_negocio", "type": "decimal", "is_numeric": true},
            {"name": "etapa_negocio", "type": "varchar", "is_text": true},
            {"name": "data_abertura", "type": "datetime", "is_date": true},
            {"name": "data_conclusao", "type": "datetime", "is_date": true}
        ]'::JSONB,
        'Oportunidades de negócio',
        'funil-vendas'
        ),

        ('VW_Ceres_OrdemServico', 'ordem_servico', 18,
        '[
            {"name": "os_id", "type": "integer", "is_numeric": true, "is_primary_key": true},
            {"name": "cliente_id", "type": "integer", "is_numeric": true},
            {"name": "tecnico_id", "type": "integer", "is_numeric": true},
            {"name": "tipo_servico", "type": "varchar", "is_text": true},
            {"name": "status", "type": "varchar", "is_text": true},
            {"name": "tempo_atendimento", "type": "integer", "is_numeric": true},
            {"name": "avaliacao_cliente", "type": "decimal", "is_numeric": true}
        ]'::JSONB,
        'Ordens de serviço técnicas',
        'pos-venda'
        );

    -- Inserir relacionamentos iniciais
    INSERT INTO insights.view_relationships (
        source_view,
        target_view,
        relationship_type,
        relationship_strength,
        description
    ) VALUES
        ('VW_Ceres_CRM_CarteiraClientes', 'VW_Ceres_CRM_Negocios', 'one-to-many', 0.85,
        'Clientes podem ter múltiplos negócios associados'),

        ('VW_Ceres_CRM_Negocios', 'VW_Ceres_OrdemServico', 'one-to-many', 0.75,
        'Negócios podem gerar ordens de serviço');

    -- Inserir insights iniciais
    INSERT INTO insights.insights (
        title,
        description,
        category,
        severity,
        metric_type,
        data_source,
        dashboard_id,
        sql_query,
        business_impact,
        recommendation,
        is_relevant
    ) VALUES
        ('Distribuição Regional de Clientes', 'Análise da distribuição de clientes por região para identificar oportunidades de expansão', 'crm-comercial', 'info', 'distribution', 'VW_Ceres_CRM_CarteiraClientes', dashboard_id,
        'SELECT regiao, COUNT(*) as qtde_clientes, SUM(valor_comercial) as valor_total FROM VW_Ceres_CRM_CarteiraClientes GROUP BY regiao ORDER BY valor_total DESC',
        'high',
        'Considerar expandir para regiões com alta concentração de clientes',
        true),

        ('Taxa de Conversão do Funil', 'Métrica de eficiência na conversão de oportunidades em negócios concluídos', 'funil-vendas', 'warning', 'conversion_rate', 'VW_Ceres_CRM_Negocios', dashboard_id,
        'SELECT COUNT(CASE WHEN etapa_negocio = ''Concluído'' THEN 1 END) * 100.0 / COUNT(*) as taxa_conversao FROM VW_Ceres_CRM_Negocios',
        'high',
        'Implementar estratégias para aumentar a taxa de conversão nas etapas intermediárias',
        true),

        ('Performance de Atendimento Técnico', 'Análise do tempo médio de atendimento e avaliação dos clientes', 'pos-venda', 'critical', 'performance', 'VW_Ceres_OrdemServico', dashboard_id,
        'SELECT AVG(tempo_atendimento) as tempo_medio, AVG(avaliacao_cliente) as avaliacao_media FROM VW_Ceres_OrdemServico',
        'medium',
        'Focar em reduzir o tempo de atendimento e melhorar a qualidade do serviço',
        true);

    -- Criar análise inicial no histórico
    INSERT INTO insights.analysis_history (
        analysis_type,
        status,
        start_time,
        end_time,
        duration_seconds,
        total_items_processed,
        success_rate,
        parameters,
        results
    ) VALUES
        ('view_analysis', 'completed', now(), now(), 5, 40, 1.0,
        '{"views_analyzed": 40, "business_context_covered": 0.8}',
        '{"total_views": 40, "analysis_completed": true, "timestamp": "' || now() || '"}');

END;
$$ LANGUAGE plpgsql;

-- Executar função de dados iniciais
SELECT insights.populate_initial_data();