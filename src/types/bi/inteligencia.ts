// Types for rpc_inteligencia_esforco_bi (server-side aggregation)

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
