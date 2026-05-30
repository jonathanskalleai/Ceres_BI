// supabase/functions/business-context/index.ts - Agente BusinessContext para análise de contexto de negócio
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
    const { view_analysis, company_name } = body

    const businessContext = await analyzeBusinessContext(view_analysis, company_name)

    return new Response(JSON.stringify({
      success: true,
      data: businessContext,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('BusinessContext error:', error)
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

// Função principal de análise de contexto de negócio
async function analyzeBusinessContext(view_analysis: any, company_name?: string) {
  const company = company_name || 'Ceres Equipamentos'

  // Identificar áreas de negócio com base nas views analisadas
  const businessAreas = identifyBusinessAreasFromViews(view_analysis)

  // Extrair indicadores de desempenho chave
  const keyPerformanceIndicators = extractKeyPerformanceIndicators(view_analysis)

  // Determinar maturidade de dados
  const dataMaturity = assessDataMaturity(view_analysis)

  // Identificar pontos de integração
  const integrationPoints = identifyIntegrationPoints(view_analysis)

  // Analisar prioridades de negócio
  const businessPriorities = analyzeBusinessPriorities(view_analysis, businessAreas)

  return {
    company_name: company,
    business_areas: businessAreas,
    key_performance_indicators: keyPerformanceIndicators,
    data_maturity: dataMaturity,
    integration_points: integrationPoints,
    business_priorities: businessPriorities,
    analysis_timestamp: new Date().toISOString(),
    context_completeness: calculateContextCompleteness(businessAreas, keyPerformanceIndicators),
    insights_potential: assessInsightsPotential(view_analysis),
  }
}

// Identificar áreas de negócio com base nas views
function identifyBusinessAreasFromViews(view_analysis: any) {
  const areas = new Map<string, any>()

  view_analysis.views_analyzed.forEach((view: any) => {
    view.business_areas.forEach((area: any) => {
      if (!areas.has(area.category)) {
        areas.set(area.category, {
          name: area.category,
          description: getBusinessAreaDescription(area.category),
          data_sources: [view.view_name],
          relevance: area.relevance,
          view_count: 1,
          total_metrics: estimateMetricsForView(view.view_name),
        })
      } else {
        const existingArea = areas.get(area.category)
        existingArea.data_sources.push(view.view_name)
        existingArea.view_count += 1
        existingArea.relevance = Math.max(existingArea.relevance, area.relevance)
      }
    })
  })

  return Array.from(areas.values()).sort((a, b) => b.relevance - a.relevance)
}

// Extrair indicadores de desempenho chave
function extractKeyPerformanceIndicators(view_analysis: any) {
  const kpis = []

  // KPIs comuns para CRM comercial
  if (hasViews(view_analysis, ['VW_Ceres_CRM_CarteiraClientes', 'VW_Ceres_CRM_Acoes'])) {
    kpis.push({
      id: 'crm_client_count',
      title: 'Total de Clientes na Carteira',
      description: 'Número total de clientes ativos na carteira comercial',
      metric_formula: 'COUNT(DISTINCT cliente_id)',
      metric_aggregation: 'count',
      metric_column: 'cliente_id',
      data_source: 'VW_Ceres_CRM_CarteiraClientes',
      business_impact: 'high',
      category: 'crm-comercial',
    })

    kpis.push({
      id: 'crm_action_frequency',
      title: 'Frequência de Ações Comerciais',
      description: 'Número médio de ações comerciais por cliente por período',
      metric_formula: 'COUNT(acao_id) / COUNT(DISTINCT cliente_id)',
      metric_aggregation: 'avg',
      metric_column: 'acao_id',
      data_source: 'VW_Ceres_CRM_Acoes',
      business_impact: 'medium',
      category: 'crm-comercial',
    })
  }

  // KPIs para negócios
  if (hasViews(view_analysis, ['VW_Ceres_CRM_Negocios', 'VW_Ceres_CRM_FunilEtapa'])) {
    kpis.push({
      id: 'pipeline_conversion_rate',
      title: 'Taxa de Conversão do Pipeline',
      description: 'Percentual de negócios convertidos em pedidos',
      metric_formula: 'COUNT(CASE WHEN etapa_id = 3 THEN 1 END) * 100.0 / COUNT(*)',
      metric_aggregation: 'percentage',
      metric_column: 'etapa_id',
      data_source: 'VW_Ceres_CRM_FunilEtapa',
      business_impact: 'high',
      category: 'pipeline',
    })

    kpis.push({
      id: 'avg_deal_value',
      title: 'Valor Médio do Negócio',
      description: 'Valor médio dos negócios no pipeline',
      metric_formula: 'AVG(valor_negocio)',
      metric_aggregation: 'avg',
      metric_column: 'valor_negocio',
      data_source: 'VW_Ceres_CRM_Negocios',
      business_impact: 'high',
      category: 'pipeline',
    })
  }

  // KPIs para pós-venda
  if (hasViews(view_analysis, ['VW_Ceres_OrdemServico', 'VW_Ceres_Ocorrencias'])) {
    kpis.push({
      id: 'service_completion_rate',
      title: 'Taxa de Conclusão de Serviços',
      description: 'Percentual de ordens de serviço concluídas',
      metric_formula: 'COUNT(CASE WHEN status = "Concluído" THEN 1 END) * 100.0 / COUNT(*)',
      metric_aggregation: 'percentage',
      metric_column: 'status',
      data_source: 'VW_Ceres_OrdemServico',
      business_impact: 'medium',
      category: 'pos-venda',
    })

    kpis.push({
      id: 'avg_service_time',
      title: 'Tempo Médio de Atendimento',
      description: 'Tempo médio para concluir uma ordem de serviço',
      metric_formula: 'AVG(tempo_atendimento)',
      metric_aggregation: 'avg',
      metric_column: 'tempo_atendimento',
      data_source: 'VW_Ceres_OrdemServico',
      business_impact: 'medium',
      category: 'pos-venda',
    })
  }

  return kpis
}

// Avaliar maturidade de dados
function assessDataMaturity(view_analysis: any): 'basic' | 'intermediate' | 'advanced' {
  const totalViews = view_analysis.total_views_analyzed
  const hasRelationships = view_analysis.views_analyzed.some((view: any) => view.relationships.length > 0)
  const hasBusinessAreas = view_analysis.views_analyzed.some((view: any) => view.business_areas.length > 0)
  const avgScore = view_analysis.views_analyzed.reduce((acc: number, view: any) => acc + view.analysis_score, 0) / totalViews

  if (totalViews >= 30 && hasRelationships && hasBusinessAreas && avgScore > 0.8) {
    return 'advanced'
  } else if (totalViews >= 20 && hasRelationships && avgScore > 0.6) {
    return 'intermediate'
  } else {
    return 'basic'
  }
}

// Identificar pontos de integração
function identifyIntegrationPoints(view_analysis: any) {
  const integrations = []

  // Integração entre CRM e produtos
  if (hasViews(view_analysis, ['VW_Ceres_CRM_Pedidos', 'VW_Ceres_Produtos'])) {
    integrations.push({
      source: 'CRM Pedidos',
      target: 'Catálogo de Produtos',
      description: 'Relacionamento entre pedidos e produtos',
      integration_type: 'data_enrichment',
      business_value: 'high',
    })
  }

  // Integração entre ordens de serviço e técnicos
  if (hasViews(view_analysis, ['VW_Ceres_OrdemServico', 'VW_Ceres_Usuario'])) {
    integrations.push({
      source: 'Ordens de Serviço',
      target: 'Técnicos',
      description: 'Atribuição de ordens a técnicos disponíveis',
      integration_type: 'resource_optimization',
      business_value: 'medium',
    })
  }

  // Integração entre agenda e atividades
  if (hasViews(view_analysis, ['VW_Ceres_Agenda', 'VW_Ceres_AtividadeExtra'])) {
    integrations.push({
      source: 'Agenda',
      target: 'Atividades Extras',
      description: 'Integração de atividades na agenda comercial',
      integration_type: 'process_automation',
      business_value: 'medium',
    })
  }

  return integrations
}

// Analisar prioridades de negócio
function analyzeBusinessPriorities(view_analysis: any, business_areas: any[]) {
  const priorities = []

  // Priorizar CRM se tiver muitas views relacionadas
  const crmViews = view_analysis.views_analyzed.filter((view: any) =>
    view.view_name.includes('CRM') || view.view_name.includes('Negocios')
  )

  if (crmViews.length > 5) {
    priorities.push({
      area: 'crm-comercial',
      priority: 'high',
      reason: 'Alta quantidade de dados de CRM indica oportunidades de otimização comercial',
      estimated_impact: 'high',
    })
  }

  // Priorizar serviços se houver muitas ordens de serviço
  const serviceViews = view_analysis.views_analyzed.filter((view: any) =>
    view.view_name.includes('OrdemServico') || view.view_name.includes('Ocorrencias')
  )

  if (serviceViews.length > 3) {
    priorities.push({
      area: 'pos-venda',
      priority: 'medium',
      reason: 'Dados operacionais indicam oportunidades de melhoria na qualidade de serviço',
      estimated_impact: 'medium',
    })
  }

  // Priorizar produtos se houver catálogo completo
  const productViews = view_analysis.views_analyzed.filter((view: any) =>
    view.view_name.includes('Produtos')
  )

  if (productViews.length > 2) {
    priorities.push({
      area: 'produtos',
      priority: 'medium',
      reason: 'Catálogo de produtos completo permite análise de rentabilidade e tendências',
      estimated_impact: 'medium',
    })
  }

  return priorities.sort((a, b) => b.priority.localeCompare(a.priority))
}

// Calcular completude do contexto
function calculateContextCompleteness(business_areas: any[], kpis: any[]): number {
  const areaCoverage = business_areas.length > 0 ? 1.0 : 0.0
  const kpiCoverage = kpis.length > 5 ? 1.0 : kpis.length / 5
  const completenessScore = (areaCoverage * 0.6) + (kpiCoverage * 0.4)

  return Math.min(1.0, completenessScore)
}

// Avaliar potencial de insights
function assessInsightsPotential(view_analysis: any): number {
  const totalViews = view_analysis.total_views_analyzed
  const avgAnalysisScore = view_analysis.views_analyzed.reduce((acc: number, view: any) => acc + view.analysis_score, 0) / totalViews
  const totalRelationships = view_analysis.views_analyzed.reduce((acc: number, view: any) => acc + view.relationships.length, 0)

  // Potencial baseado em quantidade e qualidade de dados
  const potential = (totalViews * 0.3) + (avgAnalysisScore * 0.4) + (totalRelationships * 0.3)

  return Math.min(1.0, potential)
}

// Funções auxiliares
function hasViews(view_analysis: any, viewNames: string[]): boolean {
  const analyzedViews = view_analysis.views_analyzed.map((view: any) => view.view_name)
  return viewNames.some(viewName => analyzedViews.includes(viewName))
}

function getBusinessAreaDescription(category: string): string {
  const descriptions: { [key: string]: string } = {
    'comercial': 'Vendas e relacionamento com clientes',
    'produtos': 'Gestão de produtos e catálogo',
    'servicos': 'Atendimento técnico e serviços',
    'operacoes': 'Operações diárias e agendamentos',
    'administrativo': 'Usuários e configurações do sistema',
  }

  return descriptions[category] || 'Área de negócio não especificada'
}

function estimateMetricsForView(viewName: string): number {
  // Estimativa simplificada de métricas por view
  const estimations: { [key: string]: number } = {
    'VW_Ceres_CRM_CarteiraClientes': 5,
    'VW_Ceres_CRM_Acoes': 8,
    'VW_Ceres_CRM_Negocios': 6,
    'VW_Ceres_Produtos': 4,
    'VW_Ceres_OrdemServico': 7,
    'VW_Ceres_Ocorrencias': 6,
  }

  return estimations[viewName] || 3
}