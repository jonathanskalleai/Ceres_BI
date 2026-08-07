// Types for rpc_pedidos_bi (server-side aggregation)

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
