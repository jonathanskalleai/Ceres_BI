/** Recorte da carteira exibido no Termômetro de Fechamento. */
export type AcoesTermometroEscopo = "ativos_periodo" | "carteira_total";

/** Uma faixa da escala CRM de probabilidade (0 a 5 estrelas). */
export interface AcoesTermometroFaixa {
  estrelas: number;
  negocios: number;
  /** Clientes distintos; um cliente pode ter mais de um negócio aberto. */
  clientes: number;
  valor: number;
  valorPonderado: number;
}

export interface AcoesTermometroResumo {
  negocios: number;
  /** Clientes distintos na carteira analisada. */
  clientes: number;
  valorBruto: number;
  valorPonderado: number;
  negociosQuentes: number;
  valorQuente: number;
}

/** Uma oportunidade priorizada pela probabilidade do CRM e, em seguida, valor. */
export interface AcoesTermometroPrioridade {
  negocio: string;
  cliente: string;
  produto: string;
  etapa: string | null;
  consultor: string | null;
  valor: number;
  estrelas: number;
  valorPonderado: number;
}

/** Retorno de rpc_acoes_termometro_fechamento. */
export interface RpcAcoesTermometroFechamento {
  resumo: AcoesTermometroResumo;
  faixas: AcoesTermometroFaixa[];
  prioridades: AcoesTermometroPrioridade[];
}
