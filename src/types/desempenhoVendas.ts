export interface DesempenhoKPIs {
  faturamento: number;
  totalPedidos: number;
  ticketMedio: number;
  valorFinanciado: number;
  valorRecursoProprio: number;
  percentFinanciado: number;
  percentRecursoProprio?: number;
  valorPerdido: number;
  totalPerdido?: number;
  qtdPerdido?: number;
  ticketMedioPerdido?: number;
  totalEmAndamento?: number;
  valorEmAndamento?: number;
  pipelineAberto?: number;
}

export interface DesempenhoMensalItem {
  mes: number;
  mesNome: string;
  qtdGanho: number;
  valorGanho: number;
  qtdPerda: number;
  valorPerda: number;
}

export interface DesempenhoVendedorItem {
  name: string;
  qtd: number;
  percent: number;
  ticketMedio: number;
  valor: number;
}

export interface DesempenhoProdutoItem {
  name: string;
  marca?: string;
  grupo?: string;
  qtd: number;
  percent: number;
  ticketMedio: number;
  valor: number;
}

export interface DesempenhoCidadeItem {
  name: string;
  qtd: number;
  percent: number;
  ticketMedio: number;
  valor: number;
}

export interface DesempenhoOrigemItem {
  name: string;
  qtd: number;
  qtdGanhos?: number;
  taxaConversao?: number;
  percent: number;
  ticketMedio: number;
  valor: number;
}

export interface DesempenhoBancoItem {
  name: string;
  qtd: number;
  percent: number;
  ticketMedio: number;
  valor: number;
}

export interface DesempenhoTipoClienteItem {
  name: string;
  qtd: number;
  percent: number;
  ticketMedio: number;
  valor: number;
}

export interface DesempenhoMotivoPerdaItem {
  name: string;
  concorrenteTop?: string;
  qtd: number;
  percent: number;
  ticketMedio?: number;
  valor: number;
}

export interface DesempenhoResumoAnualItem {
  ano: number;
  qtd: number;
  faturamento: number;
  ticketMedio: number;
}

export interface DesempenhoPerdasData {
  rankingVendedores: DesempenhoVendedorItem[];
  rankingProdutos: DesempenhoProdutoItem[];
  rankingCidades: DesempenhoCidadeItem[];
  origensLead: DesempenhoOrigemItem[];
  motivosPerda: DesempenhoMotivoPerdaItem[];
}

export interface DesempenhoVendasData {
  kpis: DesempenhoKPIs;
  serieMensal: DesempenhoMensalItem[];
  rankingVendedores: DesempenhoVendedorItem[];
  rankingProdutos: DesempenhoProdutoItem[];
  rankingCidades: DesempenhoCidadeItem[];
  origensLead: DesempenhoOrigemItem[];
  financiamentoBancos: DesempenhoBancoItem[];
  tiposCliente: DesempenhoTipoClienteItem[];
  motivosPerda: DesempenhoMotivoPerdaItem[];
  resumoAnual: DesempenhoResumoAnualItem[];
  perdas?: DesempenhoPerdasData;
}

export interface DesempenhoVendasFilterOptions {
  ano?: number | null;
  from?: string | null;
  to?: string | null;
  vendedor?: string | null;
  cidade?: string | null;
  condicao?: string | null;
}
