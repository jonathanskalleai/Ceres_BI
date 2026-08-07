// supabase/functions/analyze-views/index.ts - Agente ViewAnalyzer para análise de views SQL
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
    const { view_names, business_context } = body

    // Simulação de análise de views (implementação real conectaria ao SQL Server)
    const viewAnalysis = await analyzeViewsSQL(view_names, business_context)

    return new Response(JSON.stringify({
      success: true,
      data: viewAnalysis,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('ViewAnalyzer error:', error)
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

// Função principal de análise de views
async function analyzeViewsSQL(view_names: string[], business_context?: any) {
  const analysisResults = []

  // Views conhecidas do SQL Server do projeto Ceres
  const knownViews = [
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
  ]

  // Filtrar views que precisam ser analisadas
  const viewsToAnalyze = view_names.filter(view => knownViews.includes(view)) || knownViews

  for (const viewName of viewsToAnalyze) {
    const metadata = await getViewMetadata(viewName)
    const relationships = await findViewRelationships(viewName, viewsToAnalyze)
    const businessAreas = identifyBusinessAreas(viewName, business_context)

    analysisResults.push({
      view_name: viewName,
      metadata: metadata,
      relationships: relationships,
      business_areas: businessAreas,
      analysis_score: calculateAnalysisScore(metadata, relationships),
      analyzed_at: new Date().toISOString(),
    })
  }

  return {
    total_views_analyzed: analysisResults.length,
    views_analyzed: analysisResults,
    analysis_timestamp: new Date().toISOString(),
    business_context_covered: calculateBusinessCoverage(analysisResults, business_context),
  }
}

// Função para extrair metadata da view
async function getViewMetadata(viewName: string) {
  // Simulação - implementação real faria consulta ao banco de dados
  const sampleColumns = [
    { name: 'id', type: 'integer', is_numeric: true, is_primary_key: true },
    { name: 'nome', type: 'varchar', is_text: true },
    { name: 'valor', type: 'decimal', is_numeric: true },
    { name: 'data_criacao', type: 'datetime', is_date: true },
    { name: 'ativo', type: 'boolean', is_numeric: true },
  ]

  return {
    view_name: viewName,
    table_name: viewName.replace('VW_', ''),
    column_count: sampleColumns.length,
    columns: sampleColumns,
    description: getTableDescription(viewName),
    business_category: classifyBusinessCategory(viewName),
    data_type_distribution: {
      numeric: sampleColumns.filter(c => c.is_numeric).length,
      text: sampleColumns.filter(c => c.is_text).length,
      date: sampleColumns.filter(c => c.is_date).length,
      boolean: sampleColumns.filter(c => c.type === 'boolean').length,
    }
  }
}

// Função para encontrar relacionamentos entre views
async function findViewRelationships(viewName: string, allViews: string[]) {
  const relationships = []
  const commonRelationships = [
    { source: 'VW_Ceres_Usuario', target: 'VW_Ceres_UsuarioXEmpresa', type: 'one-to-many', description: 'Usuários pertencem a empresas' },
    { source: 'VW_Ceres_CRM_ClienteContatos', target: 'VW_Ceres_CRM_CarteiraClientes', type: 'belongs-to', description: 'Contatos pertencem a clientes' },
    { source: 'VW_Ceres_CRM_Pedidos', target: 'VW_Ceres_CRM_PedidosItem', type: 'one-to-many', description: 'Pedidos contêm itens' },
    { source: 'VW_Ceres_Negocios', target: 'VW_Ceres_CRM_FunilEtapa', type: 'belongs-to', description: 'Negócios pertencem a etapas do funil' },
  ]

  for (const rel of commonRelationships) {
    if (rel.source === viewName || rel.target === viewName) {
      relationships.push({
        ...rel,
        strength: Math.random() * 0.5 + 0.5, // Random strength for demo
        created_at: new Date().toISOString(),
      })
    }
  }

  return relationships
}

// Função para identificar áreas de negócio
function identifyBusinessAreas(viewName: string, business_context?: any) {
  const businessCategories: { [key: string]: string[] } = {
    'comercial': ['VW_Ceres_CRM_Acoes', 'VW_Ceres_CRM_CarteiraClientes', 'VW_Ceres_CRM_Negocios'],
    'produtos': ['VW_Ceres_Produtos', 'VW_Ceres_ProdutosGrupo', 'VW_Ceres_ProdutosMarca', 'VW_Ceres_ProdutosModelo'],
    'servicos': ['VW_Ceres_OrdemServico', 'VW_Ceres_Ocorrencias', 'VW_Ceres_AtendimentoOS'],
    'operacoes': ['VW_Ceres_Agenda', 'VW_Ceres_AtividadeExtra', 'VW_Ceres_TecnicoTempo'],
    'administrativo': ['VW_Ceres_Usuario', 'VW_Ceres_UsuarioXEmpresa', 'VW_Ceres_Empresas'],
  }

  const areas = []
  for (const [category, views] of Object.entries(businessCategories)) {
    if (views.includes(viewName)) {
      areas.push({
        category: category,
        relevance: 1.0,
        description: getBusinessAreaDescription(category),
      })
    }
  }

  return areas
}

// Função auxiliar para classificar categoria de negócio
function classifyBusinessCategory(viewName: string): string {
  if (viewName.includes('CRM')) return 'crm-comercial'
  if (viewName.includes('Produtos')) return 'produtos'
  if (viewName.includes('OrdemServico') || viewName.includes('Ocorrencias')) return 'servicos'
  if (viewName.includes('Agenda') || viewName.includes('Tecnico')) return 'operacoes'
  if (viewName.includes('Usuario') || viewName.includes('Empresas')) return 'administrativo'
  return 'geral'
}

// Função auxiliar para descrição de tabela
function getTableDescription(viewName: string): string {
  const descriptions: { [key: string]: string } = {
    'VW_Ceres_Usuario': 'Dados dos usuários do sistema',
    'VW_Ceres_Empresas': 'Empresas clientes da Ceres Equipamentos',
    'VW_Ceres_CRM_CarteiraClientes': 'Clientes na carteira comercial',
    'VW_Ceres_CRM_Acoes': 'Ações comerciais realizadas',
    'VW_Ceres_CRM_Negocios': 'Oportunidades de negócio',
    'VW_Ceres_Produtos': 'Catálogo de produtos',
    'VW_Ceres_OrdemServico': 'Ordens de serviço',
    'VW_Ceres_Ocorrencias': 'Ocorrências técnicas',
    'VW_Ceres_Agenda': 'Agenda de atividades',
  }

  return descriptions[viewName] || `Dados da view ${viewName}`
}

// Função auxiliar para descrição de área de negócio
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

// Função para calcular score de análise
function calculateAnalysisScore(metadata: any, relationships: any): number {
  const columnScore = metadata.column_count * 0.2
  const relationshipScore = relationships.length * 0.3
  const completenessScore = metadata.data_type_distribution.numeric > 0 ? 0.5 : 0.2

  return Math.min(1.0, columnScore + relationshipScore + completenessScore)
}

// Função para calcular cobertura de negócio
function calculateBusinessCoverage(analysisResults: any[], business_context?: any): number {
  const categories = new Set()
  analysisResults.forEach(result => {
    result.business_areas.forEach((area: any) => categories.add(area.category))
  })

  const totalCategories = 5 // total de categorias principais
  return categories.size / totalCategories
}