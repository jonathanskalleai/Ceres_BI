export interface ClienteCriticoBI {
  clienteId: string | number;
  cliente: string;
  cidade: string | null;
  consultor: string | null;
  ultimaAcao: string | null;
  diasSemAcao: number;
  semAcaoRegistrada: boolean;
  valorEmRisco: number;
}

/** Retorno de rpc_clientes_criticos_bi; não substitui as faixas anuais de risco. */
export interface RpcClientesCriticosBI {
  totalCriticos: number;
  semAcaoRegistrada: number;
  valorEmRisco: number;
  rows: ClienteCriticoBI[];
}
