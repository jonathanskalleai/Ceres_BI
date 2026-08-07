// supabase/functions/analyze-dashboard/index.ts - Análise de dashboard específico
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
    const { dashboard_id, filters, time_period } = body

    // Obter dashboard do banco de dados
    const { data: dashboard, error: dashboardError } = await supabase
      .from('dashboards')
      .select('*')
      .eq('dashboard_id', dashboard_id)
      .single()

    if (dashboardError) {
      throw new Error(`Dashboard not found: ${dashboardError.message}`)
    }

    // Gerar análise específica para o dashboard
    const dashboardAnalysis = await generateDashboardAnalysis(dashboard, filters, time_period, supabase)

    return new Response(JSON.stringify({
      success: true,
      data: dashboardAnalysis,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Dashboard analysis error:', error)
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

// Função principal de análise de dashboard
async function generateDashboardAnalysis(dashboard: any, filters: any, time_period: string, supabase: any) {
  const dashboardAnalysis = {
    dashboard_id: dashboard.dashboard_id,
    dashboard_title: dashboard.title,
    analysis_timestamp: new Date().toISOString(),
    metrics: [],
    charts: [],
    insights: [],
    recommendations: [],
    data_quality: {},
    performance_metrics: {}
  }

  // Gerar métricas do dashboard
  const metrics = await generateDashboardMetrics(dashboard, filters, time_period, supabase)
  dashboardAnalysis.metrics = metrics

  // Gerar dados para gráficos
  const charts = await generateDashboardCharts(dashboard, filters, time_period, supabase)
  dashboardAnalysis.charts = charts

  // Gerar insights específicos
  const insights = await generateDashboardInsights(dashboard, filters, time_period, supabase)
  dashboardAnalysis.insights = insights

  // Gerar recomendações
  const recommendations = await generateDashboardRecommendations(dashboard, metrics, insights)
  dashboardAnalysis.recommendations = recommendations

  // Analisar qualidade dos dados
  const dataQuality = await analyzeDataQuality(dashboard, filters, supabase)
  dashboardAnalysis.data_quality = dataQuality

  // Calcular métricas de performance
  const performanceMetrics = await calculatePerformanceMetrics(dashboard, filters, time_period, supabase)
  dashboardAnalysis.performance_metrics = performanceMetrics

  return dashboardAnalysis
}

// Gerar métricas do dashboard
async function generateDashboardMetrics(dashboard: any, filters: any, time_period: string, supabase: any) {
  const metrics = []

  // Processar cada KPI definido no dashboard
  for (const kpi of dashboard.kpis) {
    const metric = await generateKPIValue(kpi, filters, time_period, supabase)
    if (metric) {
      metrics.push(metric)
    }
  }

  return metrics
}

// Gerar valor de KPI
async function generateKPIValue(kpi: any, filters: any, time_period: string, supabase: any) {
  try {
    // Simular execução da query KPI
    let query = kpi.metric_formula
    let whereClause = generateFilterClause(filters)

    if (time_period) {
      const dateCondition = generateTimeCondition(time_period)
      if (whereClause === '1=1') {
        whereClause = dateCondition
      } else {
        whereClause = `${whereClause} AND ${dateCondition}`
      }
    }

    // Adicionar cláusula WHERE se houver filtros
    if (whereClause !== '1=1') {
      query = query.replace('WHERE ', '').replace('where ', '') // Remover WHERE existente
      query = `${query} WHERE ${whereClause}`
    }

    // Executar query simulada
    const simulatedValue = await simulateKPIQuery(kpi, query)

    return {
      kpi_id: kpi.kpi_id,
      title: kpi.title,
      value: simulatedValue,
      unit: getKPIUnit(kpi),
      trend: calculateKPITrend(kpi, simulatedValue),
      change_percentage: calculateChangePercentage(kpi, simulatedValue),
      data_source: kpi.data_source,
      last_updated: new Date().toISOString(),
      confidence: calculateKPIConfidence(kpi)
    }
  } catch (error) {
    console.error('Error generating KPI value:', error)
    return null
  }
}

// Gerar dados para gráficos
async function generateDashboardCharts(dashboard: any, filters: any, time_period: string, supabase: any) {
  const charts = []

  for (const chart of dashboard.charts_schema) {
    const chartData = await generateChartData(chart, filters, time_period, supabase)
    if (chartData) {
      charts.push({
        chart_id: chart.chart_id || `chart_${Date.now()}`,
        type: chart.type,
        title: `Gráfico de ${chart.type}`,
        data: chartData,
        metadata: {
          dimensions: chart.dimensions,
          color_scheme: chart.color_scheme,
          options: chart.options
        }
      })
    }
  }

  return charts
}

// Gerar dados de gráfico
async function generateChartData(chart: any, filters: any, time_period: string, supabase: any) {
  try {
    const chartType = chart.type
    const sampleData = []

    // Gerar dados simulados baseados no tipo de gráfico
    switch (chartType) {
      case 'bar':
        for (let i = 0; i < 7; i++) {
          sampleData.push({
            label: `Categoria ${i + 1}`,
            value: Math.floor(Math.random() * 100) + 10,
            percentage: Math.random() * 100
          })
        }
        break

      case 'line':
        for (let i = 0; i < 12; i++) {
          sampleData.push({
            month: `Mês ${i + 1}`,
            value: Math.floor(Math.random() * 1000) + 100,
            trend: Math.random() > 0.5 ? 'up' : 'down'
          })
        }
        break

      case 'pie':
        const categories = ['Categoria A', 'Categoria B', 'Categoria C', 'Categoria D']
        for (const category of categories) {
          sampleData.push({
            label: category,
            value: Math.floor(Math.random() * 100) + 10,
            percentage: Math.random() * 100
          })
        }
        break

      default:
        sampleData.push({
          label: 'Dados',
          value: Math.floor(Math.random() * 100),
          details: 'Dados simulados'
        })
    }

    return sampleData
  } catch (error) {
    console.error('Error generating chart data:', error)
    return []
  }
}

// Gerar insights específicos do dashboard
async function generateDashboardInsights(dashboard: any, filters: any, time_period: string, supabase: any) {
  const insights = []

  // Gerar insights baseados na categoria do dashboard
  switch (dashboard.category) {
    case 'crm-comercial':
      insights.push(...generateCRMInsightsForDashboard(dashboard, filters, time_period, supabase))
      break
    case 'pos-venda':
      insights.push(...generateServiceInsightsForDashboard(dashboard, filters, time_period, supabase))
      break
    case 'produtos':
      insights.push(...generateProductInsightsForDashboard(dashboard, filters, time_period, supabase))
      break
    case 'pipeline':
      insights.push(...generatePipelineInsightsForDashboard(dashboard, filters, time_period, supabase))
      break
    default:
      insights.push(...generateGeneralInsightsForDashboard(dashboard, filters, time_period, supabase))
  }

  return insights
}

// Gerar recomendações para o dashboard
async function generateDashboardRecommendations(dashboard: any, metrics: any, insights: any) {
  const recommendations = []

  // Baseado nas métricas
  for (const metric of metrics) {
    if (metric.trend === 'down' && metric.change_percentage < -10) {
      recommendations.push({
        type: 'metric_alert',
        priority: 'high',
        title: `Declínio em ${metric.title}`,
        description: `A métrica ${metric.title} caiu ${Math.abs(metric.change_percentage)}%`,
        action: 'Review e ajuste estratégico'
      })
    }
  }

  // Baseado nos insights
  for (const insight of insights) {
    if (insight.severity === 'critical') {
      recommendations.push({
        type: 'critical_insight',
        priority: 'critical',
        title: insight.title,
        description: insight.description,
        action: insight.recommendation
      })
    }
  }

  // Recomendações gerais
  recommendations.push({
    type: 'general_optimization',
    priority: 'medium',
    title: 'Otimização de Performance',
    description: 'Atualizar períodos de análise para dados mais recentes',
    action: 'Atualizar filtros de período para incluir dados dos últimos 30 dias'
  })

  return recommendations
}

// Analisar qualidade dos dados
async function analyzeDataQuality(dashboard: any, filters: any, supabase: any) {
  const quality = {
    completeness: 0.8,
    accuracy: 0.9,
    consistency: 0.85,
    timeliness: 0.7,
    overall_score: 0.8
  }

  // Avaliar completude com base nos KPIs
  const totalKPIs = dashboard.kpis.length
  const activeKPIs = dashboard.kpis.filter((kpi: any) => kpi.is_active).length
  quality.completeness = activeKPIs / totalKPIs

  // Avaliar consistência de dados
  quality.consistency = Math.random() * 0.2 + 0.8

  // Avaliar pontualidade
  quality.timeliness = Math.random() * 0.3 + 0.7

  // Calcular score geral
  quality.overall_score = (quality.completeness + quality.accuracy + quality.consistency + quality.timeliness) / 4

  return quality
}

// Calcular métricas de performance
async function calculatePerformanceMetrics(dashboard: any, filters: any, time_period: string, supabase: any) {
  const metrics = {
    load_time: Math.random() * 2 + 0.5, // 0.5 - 2.5 segundos
    data_freshness: '5 minutes ago',
    query_efficiency: 0.92,
    memory_usage: Math.random() * 50 + 30, // 30-80 MB
    cpu_usage: Math.random() * 30 + 10, // 10-40%
    cache_hit_ratio: 0.85
  }

  return metrics
}

// Funções auxiliares específicas por categoria
function generateCRMInsightsForDashboard(dashboard: any, filters: any, time_period: string, supabase: any) {
  return [
    {
      insight_id: `crm_dashboard_${Date.now()}`,
      title: 'Performance do CRM',
      description: 'Análise de indicadores de performance do sistema de CRM',
      severity: 'info' as const,
      category: 'crm-comercial',
      business_impact: 'high'
    }
  ]
}

function generateServiceInsightsForDashboard(dashboard: any, filters: any, time_period: string, supabase: any) {
  return [
    {
      insight_id: `service_dashboard_${Date.now()}`,
      title: 'Qualidade do Atendimento',
      description: 'Métricas de qualidade do atendimento técnico e pós-venda',
      severity: 'warning' as const,
      category: 'pos-venda',
      business_impact: 'medium'
    }
  ]
}

function generateProductInsightsForDashboard(dashboard: any, filters: any, time_period: string, supabase: any) {
  return [
    {
      insight_id: `product_dashboard_${Date.now()}`,
      title: 'Performance de Produtos',
      description: 'Análise de desempenho do portfólio de produtos',
      severity: 'info' as const,
      category: 'produtos',
      business_impact: 'medium'
    }
  ]
}

function generatePipelineInsightsForDashboard(dashboard: any, filters: any, time_period: string, supabase: any) {
  return [
    {
      insight_id: `pipeline_dashboard_${Date.now()}`,
      title: 'Funil de Vendas',
      description: 'Visualização e análise do pipeline de vendas',
      severity: 'info' as const,
      category: 'pipeline',
      business_impact: 'high'
    }
  ]
}

function generateGeneralInsightsForDashboard(dashboard: any, filters: any, time_period: string, supabase: any) {
  return [
    {
      insight_id: `general_dashboard_${Date.now()}`,
      title: 'Visão Geral do Dashboard',
      description: 'Indicadores gerais de performance do dashboard',
      severity: 'info' as const,
      category: 'geral',
      business_impact: 'low'
    }
  ]
}

// Funções utilitárias
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

function generateTimeCondition(time_period: string): string {
  const now = new Date()
  let startDate: Date

  switch (time_period) {
    case 'last_7_days':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case 'last_30_days':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case 'last_quarter':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      break
    case 'last_year':
      startDate = new Date(now.getFullYear() - 1, 0, 1)
      break
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }

  return `data_criacao >= '${startDate.toISOString().split('T')[0]}'`
}

function simulateKPIQuery(kpi: any, query: string): number {
  // Simular valor baseado na fórmula
  const baseValue = Math.random() * 1000 + 100
  const randomFactor = Math.random() * 0.2 + 0.9 // 0.8 - 1.0

  switch (kpi.metric_aggregation) {
    case 'sum':
      return Math.floor(baseValue * randomFactor)
    case 'avg':
      return Math.floor(baseValue * randomFactor / 10)
    case 'count':
      return Math.floor(baseValue * randomFactor / 50)
    case 'percentage':
      return Math.floor(baseValue * randomFactor / 10)
    default:
      return Math.floor(baseValue * randomFactor)
  }
}

function getKPIUnit(kpi: any): string {
  const units: { [key: string]: string } = {
    'count': 'unidades',
    'sum': 'R$',
    'avg': 'R$',
    'percentage': '%',
    'max': 'R$',
    'min': 'R$'
  }
  return units[kpi.metric_aggregation] || ''
}

function calculateKPITrend(kpi: any, currentValue: number): 'up' | 'down' | 'stable' {
  const change = Math.random() - 0.5
  if (Math.abs(change) < 0.1) return 'stable'
  return change > 0 ? 'up' : 'down'
}

function calculateChangePercentage(kpi: any, currentValue: number): number {
  return Math.floor((Math.random() - 0.5) * 20) // -10% a +10%
}

function calculateKPIConfidence(kpi: any): number {
  return Math.random() * 0.3 + 0.7 // 0.7 - 1.0
}