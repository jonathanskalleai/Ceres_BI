// Types for rpc_negocios_bi and rpc_pedidos_bi (server-side aggregation)

// ─── rpc_negocios_bi ──────────────────────────────────────────────────────────

export interface NegociosBIKpis {
  totalNegocios: number;
  ganhos: number;
  perdidos: number;
  andamento: number;
  taxaConversao: number;
  pipelineAberto: number;
  pipelinePerdido: number;
  valorGanho: number;
  ticketMedioGanho: number;
  cicloMedioDias: number;
  esforcoMedio: number;
}

export interface NegociosFunilItem {
  name: string;
  valor: number;
  qtd: number;
}

export interface NegociosOrigemItem {
  name: string;
  ganhos: number;
  perdidos: number;
  andamento: number;
  total: number;
  taxa: number;
  valorGanho: number;
}

export interface NegociosMotivoPerdaItem {
  name: string;
  valor: number;
  qtd: number;
}

export interface NegociosEvolucaoItem {
  name: string;
  novos: number;
  valorCriado: number;
}

export interface NegociosRankingConsultorItem {
  name: string;
  valorGanho: number;
  ganhos: number;
  total: number;
  taxa: number;
}

export interface NegociosVelocidadeFunilItem {
  name: string;
  diasMedio: number;
  qtd: number;
}

/** Full return type of rpc_negocios_bi */
export interface RpcNegociosBI {
  kpis: NegociosBIKpis;
  funilPorEtapa: NegociosFunilItem[];
  porOrigem: NegociosOrigemItem[];
  motivosPerda: NegociosMotivoPerdaItem[];
  evolucaoMensal: NegociosEvolucaoItem[];
  rankingConsultor: NegociosRankingConsultorItem[];
  velocidadeFunil: NegociosVelocidadeFunilItem[];
  duracaoMediaTotal: number;
}

// ─── rpc_pedidos_bi ───────────────────────────────────────────────────────────

export interface PedidosBIKpis {
  total: number;
  faturamento: number;
  ticketMedio: number;
  percentAprovado: number;
  percentFinanciado: number;
  valorCancelado: number;
}

export interface PedidosEvolucaoItem {
  name: string;
  faturamento: number;
  qtd: number;
}

export interface PedidosSituacaoItem {
  name: string;
  valor: number;
  qtd: number;
}

export interface PedidosMixItem {
  name: string;
  value: number;
}

export interface PedidosVendedorItem {
  name: string;
  value: number;
}

export interface PedidosCidadeItem {
  name: string;
  value: number;
}

export interface PedidosGrupoProdutoItem {
  name: string;
  valor: number;
  qtd: number;
}

export interface PedidosMarcaProdutoItem {
  name: string;
  valor: number;
  qtd: number;
}

export interface PedidosShareBancoItem {
  name: string;
  valor: number;
}

export interface PedidosMixFaturamento {
  financiado: number;
  recursoProprio: number;
  total: number;
}

/** Full return type of rpc_pedidos_bi */
export interface RpcPedidosBI {
  kpis: PedidosBIKpis;
  evolucaoMensal: PedidosEvolucaoItem[];
  porSituacao: PedidosSituacaoItem[];
  mixPagamento: PedidosMixItem[];
  porVendedor: PedidosVendedorItem[];
  porCidade: PedidosCidadeItem[];
  porGrupoProduto: PedidosGrupoProdutoItem[];
  porMarcaProduto: PedidosMarcaProdutoItem[];
  sharePorBanco?: PedidosShareBancoItem[];
  mixFaturamento?: PedidosMixFaturamento;
}

export interface ServicosSlaPorFilialItem {
  filial: string;
  mediaDias: number;
  totalOS: number;
}

export interface ServicosSlaPorTipoOSItem {
  tipo: string;
  mediaDias: number;
  totalOS: number;
}

// ─── rpc_servicos_bi ─────────────────────────────────────────────────────────

export interface ServicosBIKpis {
  totalOS: number;
  abertas: number;
  taxaFechamento: number;
  tempoMedioResolucao: number;
  tempoMedianoResolucao: number;
  totalOcorrencias: number;
}

export interface ServicosBINameValue {
  name: string;
  value: number;
}

/** Full return type of rpc_servicos_bi */
export interface RpcServicosBI {
  kpis: ServicosBIKpis;
  porStatus: ServicosBINameValue[];
  faixasResolucao: ServicosBINameValue[];
  evolucaoAberturas: ServicosBINameValue[];
  situacaoOcorrencias: ServicosBINameValue[];
  motivosPausa: ServicosBINameValue[];
  causasAtendimento: ServicosBINameValue[];
  slaPorFilial?: ServicosSlaPorFilialItem[];
  slaPorTipoOS?: ServicosSlaPorTipoOSItem[];
}

// ─── rpc_admin_bi ────────────────────────────────────────────────────────────

export interface AdminBIKpis {
  totalClientes: number;
  prospects: number;
  ativos: number;
  ufsCobertas: number;
  consultoresCarteira: number;
  empresas: number;
}

export interface AdminBINameValue {
  name: string;
  value: number;
}

/** Full return type of rpc_admin_bi */
export interface RpcAdminBI {
  kpis: AdminBIKpis;
  prospectVsAtivo: AdminBINameValue[];
  porTipoCliente: AdminBINameValue[];
  porUF: AdminBINameValue[];
  porConsultor: AdminBINameValue[];
}

// ─── rpc_acoes_bi ────────────────────────────────────────────────────────────

export interface AcoesBIKpis {
  totalAcoes: number;
  cidades: number;
  consultores: number;
  visitas: number;
  clientes: number;
  tiposAcaoDistintos: number;
}

export interface AcoesBINameAcoes {
  name: string;
  acoes: number;
}

export interface AcoesBIPieDatum {
  id: string;
  name: string;
  value: number;
}

/** Full return type of rpc_acoes_bi */
export interface RpcAcoesBI {
  kpis: AcoesBIKpis;
  porVendedor: AcoesBINameAcoes[];
  porCidade: AcoesBINameAcoes[];
  porMes: AcoesBINameAcoes[];
  porDiaSemana: AcoesBINameAcoes[];
  porTipoAcao: AcoesBIPieDatum[];
  porTipoContato: AcoesBIPieDatum[];
  listaAnos: string[];
}

// ─── rpc_inteligencia_esforco_bi ─────────────────────────────────────────────

export interface InteligenciaWinRateItem {
  name: string;
  ganhos: number;
  perdidos: number;
  taxa: number;
}

export interface InteligenciaVisitasItem {
  name: string;
  visitas: number;
  negocios: number;
  ratio: number;
}

/** Full return type of rpc_inteligencia_esforco_bi */
export interface RpcInteligenciaEsforcoBI {
  winRatePorVendedor: InteligenciaWinRateItem[];
  visitasPorNegocioGanho: InteligenciaVisitasItem[];
}

// ─── rpc_parque_renovacao_bi ─────────────────────────────────────────────────

export interface ParqueRenovacaoItem {
  marca: string;
  clientesComFrotaAntiga: number;
  totalMaquinas: number;
  isNossaMarca: boolean;
}

/** Full return type of rpc_parque_renovacao_bi */
export interface RpcParqueRenovacaoBI {
  frotaRenovacao: ParqueRenovacaoItem[];
}

// ─── rpc_etl_status ─────────────────────────────────────────────────────────

export interface EtlSyncStatus {
  table_name: string;
  source_view: string;
  rows_synced: number;
  last_sync_at: string;
  status: string;
  error_message: string | null;
  minutes_since_sync: number;
}
