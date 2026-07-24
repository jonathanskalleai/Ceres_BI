// Types for rpc_operacional_bi (server-side aggregation)

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
