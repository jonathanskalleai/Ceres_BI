// Types for the 5 comercial RPCs (server-side aggregation)

/** Return type of rpc_kpis_comercial — single JSON object */
export interface RpcKpisComercial {
  totalRegistros: number;
  totalClientes: number;
  totalConsultores: number;
  totalCidades: number;
  totalPipeline: number;
  totalVisitas: number;
  tiposContato: Record<string, number>;
  tiposAcao: Record<string, number>;
}

/** Row from rpc_ranking_vendedores — SETOF */
export interface RpcRankingVendedor {
  vendedor: string;
  acoes: number;
  visitas: number;
  clientes: number;
  pipeline: number;
}

/** Row from rpc_evolucao_mensal — SETOF */
export interface RpcEvolucaoMensal {
  mes: string;
  acoes: number;
  visitas: number;
  valor: number;
  clientes: number;
}

/** Row from rpc_ranking_regioes — SETOF */
export interface RpcRankingRegiao {
  cidade: string;
  acoes: number;
  valor: number;
  clientes: number;
  visitas: number;
  lat: number | null;
  lng: number | null;
}

/** Row from rpc_clientes_por_vendedor — SETOF */
export interface RpcClienteVendedor {
  cliente: string;
  cidade: string;
  acoes: number;
  visitas: number;
  valor: number;
  dias_sem_contato: number;
}

/** Common params shared by most RPCs */
export interface ComercialRpcDateParams {
  p_from: string; // ISO date YYYY-MM-DD
  p_to: string;   // ISO date YYYY-MM-DD
}
