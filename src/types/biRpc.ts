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
  /**
   * Valor dos negocios comerciais TOCADOS por acao no periodo, quebrado pelo
   * status ATUAL do negocio (`ngo_conclusao`) — nao pelo status na data da acao.
   * Fonte: SUM(ngo_vlrtotalnegociado) dedup por ngo_numero, funis comerciais.
   */
  valorAberto: number;
  negociosAberto: number;
  valorGanho: number;
  negociosGanho: number;
  valorPerdido: number;
  negociosPerdido: number;
  /**
   * Campos de CONTROLE (nao renderizados): existem para detectar um 4o status
   * de `ngo_conclusao` no futuro. Se `negociosOutrosStatus > 0`, a soma dos 3
   * cards de valor NAO fecha com `valorTocado` — o card novo esta faltando.
   */
  negociosTocados: number;
  valorTocado: number;
  negociosOutrosStatus: number;
  tempoMedioContato: number;
}

export interface AcoesBIRankingItem {
  vendedor: string;
  cidade: string;
  acoes: number;
  visitas: number;
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

export interface AcoesBIClienteItem {
  cliente: string;
  cidade: string;
  acoes: number;
  visitas: number;
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
  porVendedorCidade: AcoesBIRankingItem[];
  clientesMaisAtendidos: AcoesBIClienteItem[];
}

// ─── rpc_acoes_detalhe ───────────────────────────────────────────────────────

/** Uma linha da tabela "Acoes do Periodo" (RPC paginada, separada de rpc_acoes_bi). */
export interface AcoesDetalheItem {
  /** DD/MM/YYYY, ja formatada no servidor */
  data: string;
  /** YYYY-MM-DDTHH:MM:SS — ordenacao/parse sem ambiguidade de locale */
  dataIso: string;
  consultor: string | null;
  cliente: string | null;
  cidade: string | null;
  tipoAcao: string | null;
  tipoContato: string | null;
  /** `aco_atividadeexecutada` — o que FOI executado (nao o planejado) */
  observacao: string | null;
}

/** Full return type of rpc_acoes_detalhe. `total` = COUNT real do periodo (sem limit). */
export interface RpcAcoesDetalhe {
  rows: AcoesDetalheItem[];
  total: number;
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

// ─── rpc_etl_log ──────────────────────────────────────────────────────────────

export interface EtlRunLog {
  view_name: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "error";
  rows_affected: number | null;
  duration_ms: number | null;
  error_message: string | null;
}

// ─── rpc_operacional_bi ──────────────────────────────────────────────────────

export interface OperacionalBIKpis {
  tecnicosAtivos: number;
  kmTotal: number;
  utilizacaoMedia: number;
  percentOcioso: number;
  eventosAgenda: number;
  taxaConclusaoAgenda: number;
}

export interface OperacionalChartDatum {
  name: string;
  value: number;
}

export interface OperacionalUtilizacaoDatum {
  name: string;
  atendimento: number;
  deslocamento: number;
  ocioso: number;
}

/** Full return type of rpc_operacional_bi */
export interface RpcOperacionalBI {
  kpis: OperacionalBIKpis;
  kmPorTecnico: OperacionalChartDatum[];
  utilizacaoPorTecnico: OperacionalUtilizacaoDatum[];
  agendaPorStatus: OperacionalChartDatum[];
  agendaPorTipo: OperacionalChartDatum[];
}

// ─── rpc_produtos_bi ─────────────────────────────────────────────────────────

export interface ProdutosBIKpis {
  totalMaquinas: number;
  clientesComParque: number;
  gruposDistintos: number;
  marcasDistintas: number;
}

export interface ProdutosChartDatum {
  name: string;
  value: number;
}

/** Full return type of rpc_produtos_bi */
export interface RpcProdutosBI {
  kpis: ProdutosBIKpis;
  porGrupo: ProdutosChartDatum[];
  porMarca: ProdutosChartDatum[];
  topModelos: ProdutosChartDatum[];
}
