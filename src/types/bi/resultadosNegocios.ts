/** KPIs reconciliados para a aba Negócios & Funil. */
export interface ResultadosNegociosKpis {
  /** Pedidos aprovados no período, com negócio atual Ganho. */
  pedidosGanhos: number;
  valorGanho: number;
  /** Negócios fechados como Perdido no período. */
  negociosPerdidos: number;
  valorPerdido: number;
  /** Oportunidades que entraram no funil VENDAS no período e seguem abertas. */
  pipelineGeradoAberto: number;
  valorPipelineGeradoAberto: number;
  /** Carteira atual Em Andamento que recebeu ação concluída no período. */
  carteiraAtivaTrabalhada: number;
  valorCarteiraAtivaTrabalhada: number;
}

export interface ResultadosNegociosValorItem {
  name: string;
  negocios: number;
  valor: number;
}

export interface ResultadosNegociosPrevisaoItem {
  /** Mês no formato YYYY-MM. */
  name: string;
  negocios: number;
  valorBruto: number;
  valorPonderado: number;
}

/** Itens estão no grão produto; não representam soma de receita. */
export interface ResultadosNegociosEquipamentoItem {
  name: string;
  itens: number;
  negocios: number;
}

export interface ResultadosNegociosCobertura {
  carteiraAtiva: number;
  comOrigem: number;
  comDataPrevisao: number;
  previstos90Dias: number;
}

/** Retorno de rpc_resultados_negocios_bi. */
export interface RpcResultadosNegociosBI {
  kpis: ResultadosNegociosKpis;
  funilPorEtapa: ResultadosNegociosValorItem[];
  previsao90Dias: ResultadosNegociosPrevisaoItem[];
  origemLead: ResultadosNegociosValorItem[];
  equipamentosPipeline: ResultadosNegociosEquipamentoItem[];
  motivosPerda: ResultadosNegociosValorItem[];
  cobertura: ResultadosNegociosCobertura;
}
