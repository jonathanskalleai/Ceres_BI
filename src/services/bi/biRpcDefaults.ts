import type {
  RpcAcoesBI,
  RpcNegociosBI,
  RpcPedidosBI,
  RpcResultadosNegociosBI,
  RpcServicosBI,
  RpcAdminBI,
  RpcInteligenciaEsforcoBI,
  RpcParqueRenovacaoBI,
  RpcOperacionalBI,
  RpcProdutosBI,
} from "@/types/biRpc";

export const NEGOCIOS_BI_DEFAULTS: RpcNegociosBI = {
  kpis: {
    totalNegocios: 0, ganhos: 0, perdidos: 0, andamento: 0, taxaConversao: 0,
    pipelineAberto: 0, pipelinePerdido: 0, valorGanho: 0, ticketMedioGanho: 0,
    cicloMedioDias: 0, esforcoMedio: 0,
  },
  funilPorEtapa: [], porOrigem: [], motivosPerda: [], evolucaoMensal: [],
  rankingConsultor: [], velocidadeFunil: [], duracaoMediaTotal: 0,
};

export const RESULTADOS_NEGOCIOS_DEFAULTS: RpcResultadosNegociosBI = {
  kpis: {
    pedidosGanhos: 0, valorGanho: 0, negociosPerdidos: 0, valorPerdido: 0,
    pipelineGeradoAberto: 0, valorPipelineGeradoAberto: 0,
    carteiraAtivaTrabalhada: 0, valorCarteiraAtivaTrabalhada: 0,
  },
  funilPorEtapa: [], projecaoAnual: [],
  saudeCarteira: {
    abertos: 0, semAcao15Dias: 0, valorSemAcao15Dias: 0,
    semPrevisao: 0, valorSemPrevisao: 0, quentes: 0, valorQuentes: 0,
  },
  prioridadesFechamento: [], motivosPerda: [],
};

export const ACOES_BI_DEFAULTS: RpcAcoesBI = {
  kpis: {
    totalAcoes: 0, cidades: 0, consultores: 0, visitas: 0, clientes: 0,
    tiposAcaoDistintos: 0, valorGanho: 0, negociosGanho: 0, valorPerdido: 0,
    negociosPerdido: 0, negociosOutrosStatus: 0, tempoMedioContato: 0,
  },
  porVendedor: [], porCidade: [], porMes: [], porDiaSemana: [],
  porTipoAcao: [], porTipoContato: [], listaAnos: [], porVendedorCidade: [],
  clientesMaisAtendidos: [],
};

export const PEDIDOS_BI_DEFAULTS: RpcPedidosBI = {
  kpis: { total: 0, faturamento: 0, ticketMedio: 0, percentAprovado: 0, percentFinanciado: 0, valorCancelado: 0 },
  evolucaoMensal: [], porSituacao: [], mixPagamento: [], porVendedor: [],
  porCidade: [], porGrupoProduto: [], porMarcaProduto: [],
};

export const SERVICOS_BI_DEFAULTS: RpcServicosBI = {
  kpis: { totalOS: 0, abertas: 0, taxaFechamento: 0, tempoMedioResolucao: 0, tempoMedianoResolucao: 0, totalOcorrencias: 0 },
  porStatus: [], faixasResolucao: [], evolucaoAberturas: [], situacaoOcorrencias: [],
  motivosPausa: [], causasAtendimento: [],
};

export const ADMIN_BI_DEFAULTS: RpcAdminBI = {
  kpis: { totalClientes: 0, prospects: 0, ativos: 0, ufsCobertas: 0, consultoresCarteira: 0, empresas: 0 },
  prospectVsAtivo: [], porTipoCliente: [], porUF: [], porConsultor: [],
};

export const INTELIGENCIA_BI_DEFAULTS: RpcInteligenciaEsforcoBI = {
  winRatePorVendedor: [], visitasPorNegocioGanho: [],
};

export const PARQUE_BI_DEFAULTS: RpcParqueRenovacaoBI = { frotaRenovacao: [] };

export const OPERACIONAL_BI_DEFAULTS: RpcOperacionalBI = {
  kpis: { tecnicosAtivos: 0, kmTotal: 0, utilizacaoMedia: 0, percentOcioso: 0, eventosAgenda: 0, taxaConclusaoAgenda: 0 },
  kmPorTecnico: [], utilizacaoPorTecnico: [], agendaPorStatus: [], agendaPorTipo: [],
};

export const PRODUTOS_BI_DEFAULTS: RpcProdutosBI = {
  kpis: { totalMaquinas: 0, clientesComParque: 0, gruposDistintos: 0, marcasDistintas: 0 },
  porGrupo: [], porMarca: [], topModelos: [],
};
