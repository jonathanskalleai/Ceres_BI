export interface EquipeDesempenhoLinha {
  competencia: string;
  consultor?: string;
  oportunidade: number;
  cotacao: number;
  proposta: number;
  total: number;
  crescimento_oportunidade: number | null;
  meta: number | null;
  total_venda: number;
  desempenho_meta: number | null;
  /** Oportunidades geradas: primeira entrada do negócio no funil VENDAS. */
  negocios: number;
  /** Subconjunto dos negócios gerados no mês que ainda está Em Andamento. */
  oportunidades_abertas: number;
  /** Pedidos aprovados de negócios ganhos no mês. */
  quantidade_vendas: number;
  ticket_medio: number | null;
  clientes: number;
  taxa_conversao_negocios: number | null;
  prospeccao_maquina: number;
  taxa_conversao_maquina: number | null;
}

export interface EquipeDesempenhoData {
  rows: EquipeDesempenhoLinha[];
  team: EquipeDesempenhoLinha[];
}

export interface MetaConsultorMensal {
  consultor: string;
  competencia: string;
  meta: number;
}

export interface MetaCurvaMensal {
  mes: number;
  percentual: number;
}

export interface MetaConsultorAnual {
  consultor: string;
  metaAnual: number;
}

export interface ConfiguracaoMetas {
  ano: number;
  metaAnual: number;
  curvaMensal: MetaCurvaMensal[];
  consultores: MetaConsultorAnual[];
}
