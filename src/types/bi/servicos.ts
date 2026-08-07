// Types for rpc_servicos_bi (server-side aggregation)

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
