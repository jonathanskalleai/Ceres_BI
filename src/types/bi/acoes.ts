// Types for rpc_acoes_bi + rpc_acoes_detalhe (server-side aggregation)

export interface AcoesBIKpis {
  totalAcoes: number;
  cidades: number;
  consultores: number;
  visitas: number;
  clientes: number;
  tiposAcaoDistintos: number;
  /**
   * GANHO — regua de PEDIDO (rpc_acoes_bi v9).
   *   fonte:      mirror.crm_pedidos, dedup por `pdo_codigointerno`
   *   data:       `pdo_dthaprovacao` (data de competencia do ganho)
   *   valor:      SUM(`pdo_vlrpedido`)
   *   condicoes:  `pdo_situacaopedido = 'Aprovado'` + negocio canonico com
   *               `ngo_conclusao = 'Ganho'` + `ngo_funil <> 'REPASSE DE MAQUINA'`
   *
   * `negociosGanho` conta PEDIDOS aprovados, nao negocios.
   */
  valorGanho: number;
  negociosGanho: number;
  /**
   * PERDIDO — regua de NEGOCIO, DIFERENTE da regua do ganho (rpc_acoes_bi v9).
   *   fonte:      mirror.crm_negocios canonizado por `ngo_numero`
   *   data:       `ngo_datafechamento` (data de competencia da perda)
   *   valor:      SUM(`ngo_vlrtotalnegociado`) — valor POTENCIAL negociado
   *   condicoes:  `ngo_conclusao = 'Perdido'` + `ngo_funil <> 'REPASSE DE MAQUINA'`
   *
   * Nenhum pedido (nem `Cancelado`) alimenta este bucket. Somar `valorPerdido`
   * com `valorGanho` seria somar R$ negociado com R$ de pedido — reguas
   * diferentes; a tela nao faz essa soma em lugar nenhum.
   */
  valorPerdido: number;
  negociosPerdido: number;
  /**
   * DETECTOR (nao e card): negocios canonicos que FECHARAM na janela
   * (`ngo_datafechamento`) com `ngo_conclusao` fora de Em Andamento / Ganho /
   * Perdido — inclusive NULL.
   *
   * Perdido passou a depender inteiramente de `ngo_conclusao`, entao um 4o
   * status do ERP encolheria o card em silencio. Hoje o ERP so tem 3 status:
   * o esperado e 0, e zero AQUI e sinal de saude, nao campo morto.
   */
  negociosOutrosStatus: number;
  tempoMedioContato: number;
}

export interface AcoesBIRankingItem {
  vendedor: string;
  cidade: string;
  acoes: number;
  visitas: number;
}

export interface AcoesBINameAcoes {
  name: string;
  acoes: number;
}

export interface AcoesBIPieDatum {
  id: string;
  name: string;
  value: number;
}

export interface AcoesBIClienteItem {
  cliente: string;
  cidade: string;
  acoes: number;
  visitas: number;
}

/** Full return type of rpc_acoes_bi */
export interface RpcAcoesBI {
  kpis: AcoesBIKpis;
  porVendedor: AcoesBINameAcoes[];
  porCidade: AcoesBINameAcoes[];
  porMes: AcoesBINameAcoes[];
  porDiaSemana: AcoesBINameAcoes[];
  porTipoAcao: AcoesBIPieDatum[];
  porTipoContato: AcoesBIPieDatum[];
  listaAnos: string[];
  porVendedorCidade: AcoesBIRankingItem[];
  clientesMaisAtendidos: AcoesBIClienteItem[];
}

/** Uma linha da tabela "Acoes do Periodo" (RPC paginada, separada de rpc_acoes_bi). */
export interface AcoesDetalheItem {
  /** DD/MM/YYYY, ja formatada no servidor */
  data: string;
  /** YYYY-MM-DDTHH:MM:SS — ordenacao/parse sem ambiguidade de locale */
  dataIso: string;
  consultor: string | null;
  cliente: string | null;
  cidade: string | null;
  tipoAcao: string | null;
  tipoContato: string | null;
  /** `aco_atividadeexecutada` — o que FOI executado (nao o planejado) */
  observacao: string | null;
  /** Etapa do negocio vinculado (ngo_etapa). Null se acao sem negocio. */
  etapa: string | null;
  /** Valor total do negocio vinculado (ngo_vlrtotalnegociado). Null se acao sem negocio. */
  valor: number | null;
  /** Status do negocio vinculado (ngo_conclusao). Null se acao sem negocio. */
  status: string | null;
}

/** Full return type of rpc_acoes_detalhe. `total` = COUNT real do periodo (sem limit). */
export interface RpcAcoesDetalhe {
  rows: AcoesDetalheItem[];
  total: number;
}

// --- Clientes em Risco (rpc_acoes_clientes_risco) ---

export interface ClientesRiscoFaixa {
  faixa: string;
  clientes: number;
  pct: number;
}

/** Full return type of rpc_acoes_clientes_risco. */
export interface RpcClientesRisco {
  faixas: ClientesRiscoFaixa[];
  totalCarteira: number;
  clientesComAcao: number;
  clientesSemAcao: number;
}
