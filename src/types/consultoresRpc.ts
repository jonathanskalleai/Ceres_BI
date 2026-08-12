/**
 * Linha da visao de Consultores, calculada com o mesmo contrato de negocio
 * da tela /bi/acoes. Atividade e atribuida ao executor; valores, ao dono do
 * negocio canonico.
 */
export interface RpcConsultorResumoAcoes {
  consultor: string;
  acoes: number;
  visitas: number;
  clientes: number;
  crm_quality: number;
  negocios_abertos_tocados: number;
  carteira_ativa_trabalhada: number;
  oportunidades_geradas: number;
  oportunidades_abertas: number;
  pipeline_aberto_gerado: number;
  ganhos: number;
  valor_ganho: number;
  perdidos: number;
  valor_perdido: number;
  /** NULL quando nao houve oportunidade gerada pelo consultor no periodo. */
  taxa_ganho: number | null;
}
