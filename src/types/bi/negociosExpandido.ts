/**
 * Tipos TypeScript para rpc_negocios_bi_expandido (15 blocos).
 * Baseado no contrato do data-engineer handoff.
 */

// ── Blocos individuais ──────────────────────────────────────────────────────────

export interface FaturamentoPorMarcaItem {
  marca: string;
  negocios: number;
  valor: number;
}

export interface ValorPorCondicaoPagamentoItem {
  condicao: string;
  negocios: number;
  valor_total: number;
  ticket_medio: number;
  taxa_conversao: number;
}

export interface HeatmapEtapaIdadeItem {
  etapa: string;
  faixa_idade: string;
  ordem_faixa: number;
  negocios: number;
  valor: number;
}

export interface TaxaFechamentoPorMotivoGanhoItem {
  motivo: string;
  total: number;
  ganhos: number;
  valor_ganho: number;
  taxa_conversao: number;
}

export interface RankingProdutosReceitaGanhaItem {
  produto: string;
  marca: string;
  grupo: string;
  negocios: number;
  ganhos: number;
  valor_ganho: number;
  valor_total: number;
}

export interface DistribuicaoPorGrupoProdutoItem {
  grupo: string;
  negocios: number;
  valor_ganho: number;
  valor_total: number;
}

export interface WaterfallMensalGanhoPerdidoItem {
  mes: string;
  name: string;
  ganho: number;
  perda: number;
  liquido: number;
}

export interface ValorPorCidadeItem {
  cidade: string;
  uf: string;
  negocios: number;
  valor_ganho: number;
}

export interface TaxaPerdaPorBancoItem {
  banco: string;
  total: number;
  perdidos: number;
  valor_perdido: number;
  taxa_perda: number;
}

export interface PalavrasChaveObservacaoItem {
  termo: string;
  freq: number;
  valor: number;
}

export interface TicketMedioPorFormaEntradaItem {
  forma: string;
  negocios: number;
  valor_ganho: number;
  ticket_medio: number;
  taxa_conversao: number;
}

export interface CicloVendasPorEtapaItem {
  etapa: string;
  negocios: number;
  ciclo_medio_ganhos: number | null;
  ciclo_medio_geral: number | null;
  ciclo_medio_perdas: number | null;
}

export interface UsadoRecebidoPorMesItem {
  mes: string;
  name: string;
  negocios_com_usado: number;
  valor_usado_ganho: number;
  valor_usado_total: number;
}

export interface VolumePorTipoClienteItem {
  tipo: string;
  negocios: number;
  ganhos: number;
  valor_total: number;
  valor_ganho: number;
  ticket_medio_ganho: number | null;
}

export interface ProbabilidadeVsResultadoItem {
  estrelas: number;
  total: number;
  ganhos: number;
  perdas: number;
  valor_total: number;
  taxa_conversao_real: number;
}

// ── Meta ───────────────────────────────────────────────────────────────────────

export interface NegociosExpandidoMeta {
  generated_at: string;
  p_from: string;
  p_to: string;
}

// ── Root response ──────────────────────────────────────────────────────────────

export interface NegociosExpandidoResponse {
  faturamentoPorMarca: FaturamentoPorMarcaItem[] | null;
  valorPorCondicaoPagamento: ValorPorCondicaoPagamentoItem[] | null;
  heatmapEtapaIdade: HeatmapEtapaIdadeItem[] | null;
  taxaFechamentoPorMotivoGanho: TaxaFechamentoPorMotivoGanhoItem[] | null;
  rankingProdutosReceitaGanha: RankingProdutosReceitaGanhaItem[] | null;
  distribuicaoPorGrupoProduto: DistribuicaoPorGrupoProdutoItem[] | null;
  waterfallMensalGanhoPerdido: WaterfallMensalGanhoPerdidoItem[] | null;
  valorPorCidade: ValorPorCidadeItem[] | null;
  taxaPerdaPorBanco: TaxaPerdaPorBancoItem[] | null;
  palavrasChaveObservacao: PalavrasChaveObservacaoItem[] | null;
  ticketMedioPorFormaEntrada: TicketMedioPorFormaEntradaItem[] | null;
  cicloVendasPorEtapa: CicloVendasPorEtapaItem[] | null;
  usadoRecebidoPorMes: UsadoRecebidoPorMesItem[] | null;
  volumePorTipoCliente: VolumePorTipoClienteItem[] | null;
  probabilidadeVsResultado: ProbabilidadeVsResultadoItem[] | null;
  _meta: NegociosExpandidoMeta;
}
