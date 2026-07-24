// Types for rpc_parque_renovacao_bi (server-side aggregation)

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
