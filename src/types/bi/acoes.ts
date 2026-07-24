// Types for rpc_acoes_bi + rpc_acoes_detalhe (server-side aggregation)

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
