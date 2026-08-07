// Types for rpc_negocios_bi (server-side aggregation)

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
