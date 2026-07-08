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

/** Row from rpc_ranking_vendedores_v2 — SETOF (expanded with negocios, conversao, crm_quality) */
export interface RpcRankingVendedorV2 {
  vendedor: string;
  acoes: number;
  visitas: number;
  clientes: number;
  pipeline: number;
  negocios: number;
  conversao: number;   // ganhos / (ganhos + perdidos) * 100, or 0
  crm_quality: number; // acoes_com_obs / total_acoes * 100
}

/** Row from rpc_registros_recentes — SETOF */
export interface RpcRegistroRecente {
  cliente: string;
  cidade: string;
  vendedor: string;
  tipo_contato: string;
  tipo_acao: string;
  negocio_valor: number | null;
  negocio_etapa: string | null;
  dt_conclusao: string;
  obs: string | null;
  lat: number | null;
  lng: number | null;
  status: string | null;
  nro_negocio: string | null;
}

/** Row from rpc_evolucao_negocios_12m — SETOF */
export interface RpcEvolucaoNegocios12m {
  mes: string;
  total: number;
  ganhos: number;
  perdidos: number;
  valor_ganho: number;
  valor_perdido: number;
}

/** Row from rpc_evolucao_tipos_acao_12m — SETOF (flat format: 1 row per mes+tipo) */
export interface RpcEvolucaoTiposAcao12m {
  mes: string;
  tipo_acao: string;
  total: number;
}
