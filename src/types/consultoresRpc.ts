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

export interface RpcConsultorNegocioPipeline {
  numero: string;
  cliente: string;
  cnpj_cpf: string;
  cidade: string;
  uf: string;
  telefone: string;
  email: string;
  etapa: string;
  valor: number;
  estrelas: number;
  produto: string;
  marca: string;
  modelo: string;
  grupo_produto?: string;
  condicao_produto?: string;
  quantidade: number;
  valor_unitario: number;
  observacao: string;
  obs_ultima_acao: string;
  forma_entrada: string;
  campanha: string;
  prioridade?: string;
  ciclo_vendas?: string;
  qtd_acoes?: string;
  orc_valor: number;
  orc_tipo: string;
  orc_banco: string;
  orc_observacao?: string;
  usa_maquina: string;
  usa_valor: number;
  usa_estado?: string;
  data_cadastro: string | null;
  data_atualizacao: string | null;
  data_previsao: string | null;
  data_primeiro_contato?: string | null;
}
