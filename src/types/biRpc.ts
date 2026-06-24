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

/** Full return type of rpc_negocios_bi */
export interface RpcNegociosBI {
  kpis: NegociosBIKpis;
  funilPorEtapa: NegociosFunilItem[];
  porOrigem: NegociosOrigemItem[];
  motivosPerda: NegociosMotivoPerdaItem[];
  evolucaoMensal: NegociosEvolucaoItem[];
  rankingConsultor: NegociosRankingConsultorItem[];
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

/** Full return type of rpc_pedidos_bi */
export interface RpcPedidosBI {
  kpis: PedidosBIKpis;
  evolucaoMensal: PedidosEvolucaoItem[];
  porSituacao: PedidosSituacaoItem[];
  mixPagamento: PedidosMixItem[];
  porVendedor: PedidosVendedorItem[];
  porCidade: PedidosCidadeItem[];
}
