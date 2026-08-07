// Types for rpc_produtos_bi (server-side aggregation)

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
