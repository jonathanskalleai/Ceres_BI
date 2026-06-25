/**
 * NegociosSummary — aggregate type for negocios dashboard.
 * Extracted from the legacy useNegociosData hook so downstream consumers
 * (Apresentacao2026, PerformanceComercial) can import the type without
 * depending on the deprecated hook.
 */

export interface NegocioRow {
  tipo: string;
  recebido: number;
  unidade: string;
  cliente: string;
  consultor: string;
  valor_pedido: number;
  pdo_situacao_pedido: string;
  ngo_etapa: string;
  ngo_conclusao: string;
  ngo_motivo_ganho: string;
  pdo_dth_abertura: string;
  pdo_cidade_entrega: string;
  pdo_obs_pedido: string;
  cod_consultor: string;
  pdo_vlr_recurso_proprio: number;
  usado: number;
}

export interface ClienteDetalhe {
  cliente: string;
  valorTotal: number;
  recebido: number;
  valorUsado: number;
}

export interface NegociosSummary {
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
  evolucaoMensal: { mes: string; total: number; valor: number; ganhos: number }[];
  porConsultor: { nome: string; total: number; valor: number; ganhos: number; conversao: number; ticketMedio: number; clientesAtendidos: number; recebido: number; usado: number; percentUsado: number; clientes: ClienteDetalhe[] }[];
  porRegiao: { regiao: string; total: number; valor: number; ganhos: number }[];
  porTipo: { tipo: string; total: number; valor: number }[];
  registros: NegocioRow[];
}
