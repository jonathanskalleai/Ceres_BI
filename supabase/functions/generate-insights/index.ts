// supabase/functions/generate-insights/index.ts - Agente InsightGenerator para geração de insights inteligentes
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const body = await req.json()
    const {
      view_analysis,
      business_context,
      dashboard_id,
      filters,
      time_period
    } = body

    // Gerar insights inteligentes
    const insights = await generateIntelligentInsights(view_analysis, business_context, dashboard_id, filters, time_period)

    // Armazenar insights no banco de dados
    await storeInsights(supabase, insights)

    return new Response(JSON.stringify({
      success: true,
      data: insights,
      timestamp: new Date().toISOString(),
      total_insights_generated: insights.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('InsightGenerator error:', error)
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

// Função principal de geração de insights
async function generateIntelligentInsights(
  view_analysis: any,
  business_context: any,
  dashboard_id?: string,
  filters?: any,
  time_period?: string
) {
  const insights = []

  // Gerar insights por categoria de negócio
  const businessCategories = business_context.business_areas
  for (const category of businessCategories) {
    const categoryInsights = await generateCategoryInsights(
      category,
      view_analysis,
      business_context,
      dashboard_id,
      filters,
      time_period
    )
    insights.push(...categoryInsights)
  }

  // Gerar insights relacionais entre áreas de negócio
  const relationalInsights = await generateRelationalInsights(
    view_analysis,
    business_context,
    dashboard_id,
    filters,
    time_period
  )
  insights.push(...relationalInsights)

  // Gerar insights preditivos
  const predictiveInsights = await generatePredictiveInsights(
    view_analysis,
    business_context,
    dashboard_id,
    filters,
    time_period
  )
  insights.push(...predictiveInsights)

  // Filtrar e classificar insights
  const filteredInsights = filterAndRankInsights(insights)

  return filteredInsights
}

// Gerar insights por categoria de negócio
async function generateCategoryInsights(
  category: any,
  view_analysis: any,
  business_context: any,
  dashboard_id?: string,
  filters?: any,
  time_period?: string
) {
  const categoryInsights = []

  switch (category.name) {
    case 'comercial':
      categoryInsights.push(...generateCRMInsights(view_analysis, business_context, dashboard_id, filters, time_period))
      break
    case 'produtos':
      categoryInsights.push(...generateProductInsights(view_analysis, business_context, dashboard_id, filters, time_period))
      break
    case 'servicos':
    case 'pos-venda':
      categoryInsights.push(...generateServiceInsights(view_analysis, business_context, dashboard_id, filters, time_period))
      break
    case 'operacoes':
      categoryInsights.push(...generateOperationalInsights(view_analysis, business_context, dashboard_id, filters, time_period))
      break
    case 'administrativo':
      categoryInsights.push(...generateAdministrativeInsights(view_analysis, business_context, dashboard_id, filters, time_period))
      break
  }

  return categoryInsights
}

// Gerar insights de CRM
function generateCRMInsights(view_analysis: any, business_context: any, dashboard_id?: string, filters?: any, time_period?: string) {
  const insights = []

  // Insight sobre carteira de clientes
  const carteiraViews = view_analysis.views_analyzed.filter((view: any) =>
    view.view_name === 'VW_Ceres_CRM_CarteiraClientes'
  )

  if (carteiraViews.length > 0) {
    insights.push({
      insight_id: `crm_client_portfolio_${Date.now()}`,
      title: 'Distribuição da Carteira de Clientes',
      description: 'Análise da distribuição de clientes por região e porte, identificando oportunidades de expansão',
      category: 'crm-comercial',
      severity: 'info' as const,
      metric_type: 'distribution',
      metric_value: null,
      data_source: 'VW_Ceres_CRM_CarteiraClientes',
      dashboard_id: dashboard_id || 'crm-overview',
      sql_query: `SELECT regiao, COUNT(*) as qtde_clientes, SUM(valor_comercial) as valor_total
                  FROM VW_Ceres_CRM_CarteiraClientes
                  WHERE ${generateFilterClause(filters)}
                  GROUP BY regiao
                  ORDER BY valor_total DESC`,
      generated_at: new Date().toISOString(),
      applied_filters: filters || {},
      linked_entities: {
        views: ['VW_Ceres_CRM_CarteiraClientes'],
        kpis: ['crm_client_value']
      },
      kpi_references: {
        client_count: 'Número total de clientes',
        regional_distribution: 'Distribuição geográfica',
        value_concentration: 'Concentração de valor'
      },
      recommendation: 'Considerar segmentar clientes por porte para estratégias comerciais diferenciadas',
      is_active: true,
      is_relevant: true,
      business_impact: 'high'
    })
  }

  // Insight sobre frequência de ações
  const acaoViews = view_analysis.views_analyzed.filter((view: any) =>
    view.view_name === 'VW_Ceres_CRM_Acoes'
  )

  if (acaoViews.length > 0) {
    insights.push({
      insight_id: `crm_action_frequency_${Date.now()}`,
      title: 'Frequência de Ações Comerciais',
      description: 'Análise da frequência de ações comerciais por consultor, identificando padrões de engajamento',
      category: 'crm-comercial',
      severity: 'warning' as const,
      metric_type: 'frequency',
      metric_value: null,
      data_source: 'VW_Ceres_CRM_Acoes',
      dashboard_id: dashboard_id || 'crm-consultants',
      sql_query: `SELECT consultor, COUNT(*) as total_acoes,
                          AVG(DATEDIFF(data_acao, data_anterior)) as intervalo_medio
                  FROM VW_Ceres_CRM_Acoes
                  WHERE ${generateFilterClause(filters)}
                  GROUP BY consultor
                  ORDER BY total_acoes DESC`,
      generated_at: new Date().toISOString(),
      applied_filters: filters || {},
      linked_entities: {
        views: ['VW_Ceres_CRM_Acoes'],
        kpis: ['crm_action_frequency']
      },
      kpi_references: {
        action_frequency: 'Frequência de ações',
        engagement_patterns: 'Padrões de engajamento',
        consultant_performance: 'Desempenho por consultor'
      },
      recommendation: 'Implementar treinamento para consultores com baixa frequência de ações',
      is_active: true,
      is_relevant: true,
      business_impact: 'medium'
    })
  }

  return insights
}

// Gerar insights de produtos
function generateProductInsights(view_analysis: any, business_context: any, dashboard_id?: string, filters?: any, time_period?: string) {
  const insights = []

  const produtoViews = view_analysis.views_analyzed.filter((view: any) =>
    view.view_name === 'VW_Ceres_Produtos'
  )

  if (produtoViews.length > 0) {
    insights.push({
      insight_id: `product_portfolio_${Date.now()}`,
      title: 'Análise de Portfólio de Produtos',
      description: 'Identificação de produtos mais vendidos e oportunidades de cross-selling',
      category: 'produtos',
      severity: 'info' as const,
      metric_type: 'portfolio_analysis',
      metric_value: null,
      data_source: 'VW_Ceres_Produtos',
      dashboard_id: dashboard_id || 'products-overview',
      sql_query: `SELECT grupo, COUNT(*) as qtde_produtos,
                          AVG(preco) as preco_medio,
                          SUM(qtd_estoque) as total_estoque
                  FROM VW_Ceres_Produtos
                  WHERE ${generateFilterClause(filters)}
                  GROUP BY grupo
                  ORDER BY qtde_produtos DESC`,
      generated_at: new Date().toISOString(),
      applied_filters: filters || {},
      linked_entities: {
        views: ['VW_Ceres_Produtos'],
        kpis: ['product_diversity']
      },
      kpi_references: {
        product_count: 'Contagem por grupo',
        price_analysis: 'Análise de preços',
        inventory_optimization: 'Otimização de estoque'
      },
      recommendation: 'Focar em produtos com maior margem de lucro e diversificar grupos com baixa representatividade',
      is_active: true,
      is_relevant: true,
      business_impact: 'high'
    })
  }

  return insights
}

// Gerar insights de serviços
function generateServiceInsights(view_analysis: any, business_context: any, dashboard_id?: string, filters?: any, time_period?: string) {
  const insights = []

  const ordemViews = view_analysis.views_analyzed.filter((view: any) =>
    view.view_name === 'VW_Ceres_OrdemServico'
  )

  if (ordemViews.length > 0) {
    insights.push({
      insight_id: `service_performance_${Date.now()}`,
      title: 'Performance de Atendimento Técnico',
      description: 'Análise do tempo médio de atendimento por tipo de serviço e técnico responsável',
      category: 'pos-venda',
      severity: 'critical' as const,
      metric_type: 'performance',
      metric_value: null,
      data_source: 'VW_Ceres_OrdemServico',
      dashboard_id: dashboard_id || 'services-overview',
      sql_query: `SELECT tipo_servico, tecnico,
                          AVG(tempo_atendimento) as tempo_medio,
                          COUNT(*) as total_ordens,
                          AVG(avaliacao_cliente) as avaliacao_media
                  FROM VW_Ceres_OrdemServico
                  WHERE ${generateFilterClause(filters)}
                  GROUP BY tipo_servico, tecnico
                  ORDER BY tempo_medio DESC`,
      generated_at: new Date().toISOString(),
      applied_filters: filters || {},
      linked_entities: {
        views: ['VW_Ceres_OrdemServico'],
        kpis: ['service_quality']
      },
      kpi_references: {
        service_time: 'Tempo de atendimento',
        customer_satisfaction: 'Satisfação do cliente',
        technical_efficiency: 'Eficiência técnica'
      },
      recommendation: 'Implementar plano de treinamento para técnicos com tempo de atendimento acima da média',
      is_active: true,
      is_relevant: true,
      business_impact: 'high'
    })
  }

  return insights
}

// Gerar insights relacionais
function generateRelationalInsights(view_analysis: any, business_context: any, dashboard_id?: string, filters?: any, time_period?: string) {
  const insights = []

  // Analisar relacionamento entre CRM e produtos
  if (hasViews(view_analysis, ['VW_Ceres_CRM_Pedidos', 'VW_Ceres_Produtos'])) {
    insights.push({
      insight_id: `crm_product_relation_${Date.now()}`,
      title: 'Relacionamento CRM x Produtos',
      description: 'Análise da correlação entre pedidos e produtos, identificando produtos mais lucrativos',
      category: 'integracao',
      severity: 'info' as const,
      metric_type: 'correlation',
      metric_value: null,
      data_source: 'VW_Ceres_CRM_Pedidos',
      dashboard_id: dashboard_id || 'integration-overview',
      sql_query: `SELECT p.produto, COUNT(*) as qtde_pedidos,
                          SUM(p.valor_total) as valor_total,
                          AVG(p.margem_lucro) as margem_media
                  FROM VW_Ceres_CRM_Pedidos p
                  JOIN VW_Ceres_Produtos pr ON p.produto_id = pr.produto_id
                  WHERE ${generateFilterClause(filters)}
                  GROUP BY p.produto, pr.preco, p.margem_lucro
                  ORDER BY valor_total DESC`,
      generated_at: new Date().toISOString(),
      applied_filters: filters || {},
      linked_entities: {
        views: ['VW_Ceres_CRM_Pedidos', 'VW_Ceres_Produtos'],
        kpis: ['product_profitability']
      },
      kpi_references: {
        product_sales: 'Vendas por produto',
        profit_analysis: 'Análise de lucratividade',
        cross_selling: 'Oportunidades de cross-selling'
      },
      recommendation: 'Desenvolver campanhas focadas nos produtos com maior margem de lucro',
      is_active: true,
      is_relevant: true,
      business_impact: 'high'
    })
  }

  return insights
}

// Gerar insights preditivos
function generatePredictiveInsights(view_analysis: any, business_context: any, dashboard_id?: string, filters?: any, time_period?: string) {
  const insights = []

  if (hasViews(view_analysis, ['VW_Ceres_CRM_Negocios', 'VW_Ceres_CRM_FunilEtapa'])) {
    insights.push({
      insight_id: `pipeline_forecast_${Date.now()}`,
      title: 'Previsão de Conversão do Pipeline',
      description: 'Análise preditiva da probabilidade de conversão de negócios em pedidos',
      category: 'predicao',
      severity: 'warning' as const,
      metric_type: 'prediction',
      metric_value: null,
      data_source: 'VW_Ceres_CRM_Negocios',
      dashboard_id: dashboard_id || 'pipeline-forecast',
      sql_query: `SELECT etapa_negocio, COUNT(*) as qtde_negocios,
                          AVG(valor_negocio) as valor_medio,
                          AVG(DATEDIFF(data_estimada_conclusao, data_atual)) as prazo_medio
                  FROM VW_Ceres_CRM_Negocios
                  WHERE ${generateFilterClause(filters)}
                  GROUP BY etapa_negocio
                  ORDER BY qtde_negocios DESC`,
      generated_at: new Date().toISOString(),
      applied_filters: filters || {},
      linked_entities: {
        views: ['VW_Ceres_CRM_Negocios'],
        kpis: ['conversion_probability']
      },
      kpi_references: {
        conversion_rate: 'Taxa de conversão',
        revenue_forecast: 'Previsão de receita',
        deal_probability: 'Probabilidade de negócio'
      },
      recommendation: 'Focar em negócios com alta probabilidade de conversão e prazo curto',
      is_active: true,
      is_relevant: true,
      business_impact: 'high'
    })
  }

  return insights
}

// Função para armazenar insights no banco de dados
async function storeInsights(supabase: any, insights: any[]) {
  const insightsToInsert = insights.map(insight => ({
    ...insight,
    created_at: insight.generated_at,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('insights')
    .insert(insightsToInsert)

  if (error) {
    console.error('Error storing insights:', error)
    throw new Error(`Failed to store insights: ${error.message}`)
  }
}

// Função para filtrar e classificar insights
function filterAndRankInsights(insights: any[]) {
  // Filtrar insights relevantes
  const relevantInsights = insights.filter(insight => insight.is_relevant)

  // Classificar por importância (business impact * severity weight)
  const severityWeights = {
    critical: 3,
    warning: 2,
    info: 1
  }

  const rankedInsights = relevantInsights.sort((a, b) => {
    const scoreA = a.business_impact === 'high' ? 3 : (a.business_impact === 'medium' ? 2 : 1) * severityWeights[a.severity]
    const scoreB = b.business_impact === 'high' ? 3 : (b.business_impact === 'medium' ? 2 : 1) * severityWeights[b.severity]
    return scoreB - scoreA
  })

  return rankedInsights
}

// Funções auxiliares
function hasViews(view_analysis: any, viewNames: string[]): boolean {
  const analyzedViews = view_analysis.views_analyzed.map((view: any) => view.view_name)
  return viewNames.some(viewName => analyzedViews.includes(viewName))
}

function generateFilterClause(filters?: any): string {
  if (!filters || Object.keys(filters).length === 0) {
    return '1=1'
  }

  const conditions = []
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      conditions.push(`${key} = '${value}'`)
    }
  }

  return conditions.length > 0 ? conditions.join(' AND ') : '1=1'
}