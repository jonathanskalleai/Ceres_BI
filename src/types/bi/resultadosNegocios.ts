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

/** Um mês da trajetória anual: realizado acumulado e três cenários futuros. */
export interface ResultadosNegociosProjecaoAnualItem {
  name: string;
  realizadoAcumulado: number | null;
  cenarioConservador: number | null;
  cenarioProvavel: number | null;
  cenarioOtimista: number | null;
}

/** Sinais acionáveis provenientes da junção negócio + ação. */
export interface ResultadosNegociosSaudeCarteira {
  abertos: number;
  semAcao15Dias: number;
  valorSemAcao15Dias: number;
  semPrevisao: number;
  valorSemPrevisao: number;
  quentes: number;
  valorQuentes: number;
}

/** Uma oportunidade para a fila de decisão comercial. */
export interface ResultadosNegociosPrioridade {
  negocio: string;
  cliente: string;
  produto: string;
  etapa: string;
  previsao: string | null;
  diasSemAcao: number | null;
  estrelas: number;
  valor: number;
  valorPonderado: number;
}

/** Retorno de rpc_resultados_negocios_bi. */
export interface RpcResultadosNegociosBI {
  kpis: ResultadosNegociosKpis;
  funilPorEtapa: ResultadosNegociosValorItem[];
  projecaoAnual: ResultadosNegociosProjecaoAnualItem[];
  saudeCarteira: ResultadosNegociosSaudeCarteira;
  prioridadesFechamento: ResultadosNegociosPrioridade[];
  motivosPerda: ResultadosNegociosValorItem[];
}
