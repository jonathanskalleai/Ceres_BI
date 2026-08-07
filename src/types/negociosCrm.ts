// Types for rpc_negocios_crm RPC response

export interface RpcNegociosClienteDetalhe {
  cliente: string;
  valorTotal: number;
  recebido: number;
  valorUsado: number;
}

export interface RpcNegociosConsultor {
  nome: string;
  total: number;
  valor: number;
  ganhos: number;
  conversao: number;
  ticketMedio: number;
  clientesAtendidos: number;
  recebido: number;
  usado: number;
  percentUsado: number;
  clientes: RpcNegociosClienteDetalhe[];
}

export interface RpcNegociosEvolucao {
  mes: string;
  total: number;
  valor: number;
  ganhos: number;
}

export interface RpcNegociosRegiao {
  regiao: string;
  total: number;
  valor: number;
  ganhos: number;
}

export interface RpcNegociosTipo {
  tipo: string;
  total: number;
  valor: number;
}

export interface RpcNegociosSummary {
  totalNegocios: number;
  totalValor: number;
  ticketMedio: number;
  ganhos: number;
  emAndamento: number;
  perdidos: number;
  taxaConversao: number;
  clientesAtendidos: number;
  totalRecebido: number;
  totalUsado: number;
  percentUsado: number;
}

export interface RpcNegociosCrmResult {
  summary: RpcNegociosSummary;
  evolucaoMensal: RpcNegociosEvolucao[];
  porConsultor: RpcNegociosConsultor[];
  porRegiao: RpcNegociosRegiao[];
  porTipo: RpcNegociosTipo[];
}
