/**
 * Tipos das 3 RPCs de gestao comercial da tela /bi/acoes:
 *   rpc_acoes_funil_gestao       — agregados de carteira (ranking, dias parados)
 *   rpc_acoes_funil_gestao_periodo — agregados da tela /bi/acoes por coorte mensal
 *   rpc_acoes_gestao_listas      — listas de clientes, paginadas server-side
 *   rpc_acoes_mapa_oportunidades — coorte de oportunidades do funil
 *
 * Os `| null` aqui NAO sao defensivos: sao contrato. As RPCs devolvem NULL
 * onde nao ha denominador (divisao por zero) ou onde o dado nao existe, de
 * proposito — para que a tela exiba "—" em vez de `0`, `Infinity` ou `NaN`,
 * que num BI sao numeros ERRADOS, nao ausencia de numero.
 */

// ─── rpc_acoes_funil_gestao_periodo ─────────────────────────────────────────

/**
 * Atividade, oportunidades no funil VENDAS, entradas na etapa inicial e os dois
 * DESFECHOS do periodo.
 *
 * QUATRO fontes com data de competencia propria:
 *   visitas              — mirror.crm_acoes,    `aco_dthconclusao`
 *   oportunidades        — mirror.crm_funil_etapa, primeira entrada no VENDAS
 *   etapa inicial        — mirror.crm_funil_etapa, `fne_dthinicioetapa`
 *   ganhos               — mirror.crm_pedidos,  `pdo_dthaprovacao`, PEDIDO / `pdo_vlrpedido`
 *   perdidos             — mirror.crm_negocios, `ngo_datafechamento`, NEGOCIO / `ngo_vlrtotalnegociado`
 *
 * ATENCAO (v6): `ganhos` e `perdidos` sao desfechos PARALELOS, nao degraus
 * consecutivos. Perdido NAO fica abaixo de Ganho no funil e NAO existe taxa
 * `ganhos / (ganhos + perdidos)`: as reguas de valor sao diferentes (R$ de
 * pedido vs R$ negociado) e as janelas tambem.
 *
 * `oportunidades` e mantido como chave de compatibilidade, mas seu significado
 * exibido e **oportunidades do funil VENDAS**: uma coorte pela primeira entrada
 * no funil no intervalo. A etapa CRM `1-OPORTUNIDADE` e apenas a etapa inicial,
 * exposta separadamente nos campos de etapa.
 */
export interface AcoesFunil {
  /**
   * Acoes de contato presencial no periodo. NAO sofre recorte de
   * `REPASSE DE MAQUINA` — o recorte de Repasse vale so para oportunidade,
   * ganho e perdido.
   */
  visitas: number;
  /**
   * Chave legada: negocios cuja primeira entrada historica no funil VENDAS
   * ocorreu no periodo, sem `REPASSE DE MAQUINA`, independentemente do status
   * e do funil atuais. A UI chama esta metrica de "Oportunidades no funil VENDAS".
   */
  oportunidades: number;
  /** SUM(ngo_vlrtotalnegociado) da coorte de oportunidades geradas. */
  valorOportunidades: number;
  /** Subconjunto da coorte que hoje segue `Em Andamento`. */
  oportunidadesAbertas: number;
  /** SUM(ngo_vlrtotalnegociado) do subconjunto ainda aberto. */
  valorOportunidadesAbertas: number;
  /** Negócios abertos com ao menos uma ação concluída no período (carteira ativa). */
  negociosAbertosTocadosNoPeriodo: number;
  /** Valor da carteira ativa: inclui negócios abertos em meses anteriores. */
  valorPipelineAbertoTocadoNoPeriodo: number;
  /** Entradas na etapa CRM `OPORTUNIDADE` (funil VENDAS) no periodo. */
  entradasEtapaOportunidade: number;
  /** Entradas da mesma janela que hoje seguem em `1-OPORTUNIDADE` e abertas. */
  emEtapaOportunidade: number;
  /** Contagem de PEDIDOS aprovados no periodo (nao de negocios). */
  ganhos: number;
  /** Contagem de NEGOCIOS perdidos que fecharam no periodo. */
  perdidos: number;
  /** SUM(ngo_vlrtotalnegociado) dos perdidos — valor POTENCIAL, nao faturado. */
  valorPerdido: number;
  /** NULL quando nao ha oportunidades (divisao por zero) — exibir "—". */
  visitasPorOportunidade: number | null;
  /** NULL quando nao ha ganhos (divisao por zero) — exibir "—". */
  oportPorFechamento: number | null;
}

/**
 * Linha do ranking. ATRIBUICAO HIBRIDA (E1), medida no banco vivo:
 *   visitas + oportunidades -> `aco_vendedor`   (quem EXECUTOU a acao)
 *   ganhos  + valorGanho    -> `ngo_vendedores` (a quem o negocio PERTENCE)
 *     via pedidos APROVADOS (pdo_situacaopedido='Aprovado', pdo_dthaprovacao no periodo)
 *   perdidos                -> `ngo_vendedores` (negocio perdido por data de fechamento)
 * Por isso `taxaConversao` mistura as duas origens e pode passar de 100%:
 * serve para comparar consultores entre si, nao como taxa auditavel.
 */
export interface AcoesRankingConsultorItem {
  consultor: string;
  visitas: number;
  oportunidades: number;
  ganhos: number;
  perdidos: number;
  valorGanho: number;
  /** NULL quando o consultor nao tem oportunidade no periodo — exibir "—". */
  taxaConversao: number | null;
}

/** MEDIANA (nao media — a distribuicao tem cauda longa) de dias sem acao. */
export interface AcoesDiasParados {
  /** NULL quando nao ha negocio aberto no recorte. */
  mediana: number | null;
  media: number | null;
  negociosAbertos: number;
}

/**
 * Custos da atribuicao hibrida, expostos de proposito: `somaGanhosRanking`
 * pode ser MENOR que `funil.ganhos` porque um ganho sem `ngo_vendedores` conta
 * no funil e nao aparece em nenhuma linha do ranking. Omitir isso da tela e
 * falha por omissao — o gestor soma a coluna e nao bate com o card ao lado.
 */
export interface AcoesFunilMeta {
  acoesSemConsultor: number;
  ganhosSemAtribuicao: number;
  /**
   * Espelho de `ganhosSemAtribuicao` do lado dos PERDIDOS (v6): negocio perdido
   * cujo `ngo_vendedores` nao mapeia em `usuarios` nao entra em nenhuma linha
   * de ranking. Sem expor isso, o registro some em silencio quando o usuario
   * filtra por consultor.
   */
  perdidosSemAtribuicao: number;
  somaGanhosRanking: number;
}

export interface RpcAcoesFunilGestao {
  funil: AcoesFunil;
  rankingConsultores: AcoesRankingConsultorItem[];
  diasParados: AcoesDiasParados;
  meta: AcoesFunilMeta;
}

/** Taxa operacional de ganho sobre oportunidades geradas no periodo. */
export interface AcoesTaxaGanhoNegocios {
  ganhos: number;
  oportunidades: number;
  /** NULL quando nao ha oportunidades geradas no recorte. */
  taxaGanho: number | null;
}

// ─── rpc_acoes_gestao_listas ────────────────────────────────────────────────

export type AcoesGestaoListaTipo = "sem_contato" | "desperdicio" | "negativas";

export interface AcoesSemContatoRow {
  clienteId: string;
  cliente: string | null;
  cidade: string | null;
  consultor: string | null;
  /**
   * 999 e SENTINELA de "nenhuma acao no ano", nao um numero de dias real.
   * Renderizar "999 dias" e mentira — use `semAcaoNoAno` para decidir o label.
   */
  dias: number;
  semAcaoNoAno: boolean;
  /** DD/MM/YYYY, ja formatada no servidor. NULL quando nunca houve acao. */
  ultimaAcao: string | null;
  temOportunidadeAberta: boolean;
}

export interface AcoesDesperdicioRow {
  clienteId: string;
  cliente: string | null;
  cidade: string | null;
  visitas: number;
  acoes: number;
  oportunidades: number;
  /** NULL quando nenhuma oportunidade foi levantada — exibir "—". */
  visitasPorOportunidade: number | null;
}

export interface AcoesNegativaNegocio {
  negocio: string;
  etapa: string | null;
  valor: number | null;
  motivoPerda: string | null;
  data: string | null;
}

export interface AcoesNegativaRow {
  clienteId: string;
  cliente: string | null;
  cidade: string | null;
  valorPerdido: number | null;
  ultimaPerda: string | null;
  /** Os 3 negocios mais recentes, todos 'Perdido' (a regra da lista). */
  negocios: AcoesNegativaNegocio[];
}

export type AcoesGestaoListaRow = AcoesSemContatoRow | AcoesDesperdicioRow | AcoesNegativaRow;

/**
 * `meta` varia por `tipo` — cada campo opcional so vem no tipo correspondente.
 * Todos existem para alimentar a LEGENDA do card: sem elas, uma lista curta
 * (negativas tem 7 clientes de 236 elegiveis) parece uma tela quebrada.
 */
export interface AcoesGestaoListaMeta {
  tipo: AcoesGestaoListaTipo;
  /** sem_contato */
  comOportunidadeAberta?: number;
  semAcaoNoAno?: number;
  /** desperdicio */
  minVisitas?: number;
  semNenhumaOportunidade?: number;
  /** negativas */
  regra?: string;
  clientesCom3OuMaisNegocios?: number;
}

export interface AcoesGestaoListas<TRow extends AcoesGestaoListaRow> {
  rows: TRow[];
  /** COUNT real no servidor (sem limit) — maior que rows.length quando pagina. */
  total: number;
  meta: AcoesGestaoListaMeta;
}

// ─── rpc_acoes_mapa_oportunidades ───────────────────────────────────────────

export interface AcoesMapaPino {
  negocio: string;
  cliente: string | null;
  cidade: string | null;
  etapa: string | null;
  valor: number | null;
  consultor: string | null;
  /** Resultado do período: pedido aprovado, fechamento perdido ou em aberto. */
  situacao: "aberto" | "ganho" | "perdido";
  /** Quantidade de ações concluídas e vinculadas à oportunidade no período. */
  acoesNoPeriodo: number;
  /** Data da última dessas ações, em ISO. */
  ultimaAcaoPeriodo: string | null;
  lat: number;
  lon: number;
  /** Cascata de resolucao da coordenada: acao geolocalizada ou carteira. */
  origemCoord: "acao" | "carteira" | null;
  /** NULL quando o negocio nunca teve acao registrada. */
  diasParado: number | null;
}

export interface RpcAcoesMapaOportunidades {
  pinos: AcoesMapaPino[];
  total: number;
  comCoordenada: number;
  /**
   * NUNCA esconder: negocio sem coordenada nao aparece no mapa. O gestor conta
   * os pinos e acha que tem `comCoordenada` oportunidades, quando tem `total`.
   */
  semCoordenada: number;
  valorTotal: number;
  valorNoMapa: number;
  meta: {
    viaAcao: number;
    viaCarteira: number;
    abertos: number;
    ganhos: number;
    perdidos: number;
  };
}
