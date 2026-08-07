export interface ConsultorStats {
  nome?: string;
  negocios: number;
  valorTotal: number;
  ganhos: number;
  perdidos: number;
  emAndamento: number;
  visitasCRM: number;
  taxaConversao: number;
  visitas: number;
  eficiencia: number;
}

export interface ReportStats {
  individual?: string;
  periodo: { inicio: string; fim: string };
  totais: ConsultorStats;
  consultores: ConsultorStats[];
}

export interface ReportAnalise {
  nome?: string;
  classificacao?: string;
  analise?: string;
  pontos_fortes?: string[];
  pontos_fracos?: string[];
}

export interface ConsultoresReport {
  _stats: ReportStats;
  resumo_executivo?: {
    visao_geral?: string;
    destaques_positivos?: string[];
    destaques_negativos?: string[];
    conclusoes?: string[];
  };
  analise_consultores?: ReportAnalise[];
  pontos_atencao?: { severidade?: string; titulo: string; descricao: string }[];
  oportunidades?: { titulo: string; descricao: string }[];
  insights_ia?: {
    padroes?: string[];
    tendencias?: string[];
    previsoes?: string[];
  };
  recomendacoes?: { prioridade?: string; titulo: string; descricao: string }[];
  plano_acao?: {
    acoes_gestor?: string[];
    acoes_consultores?: string[];
    prioridades_curto_prazo?: string[];
  };
}
