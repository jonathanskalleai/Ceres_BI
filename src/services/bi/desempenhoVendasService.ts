import { supabase } from "@/integrations/supabase/client";
import type {
  DesempenhoVendasData,
  DesempenhoVendasFilterOptions,
} from "@/types/desempenhoVendas";

export const EMPTY_DESEMPENHO_DATA: DesempenhoVendasData = {
  kpis: {
    faturamento: 0,
    totalPedidos: 0,
    ticketMedio: 0,
    valorFinanciado: 0,
    valorRecursoProprio: 0,
    percentFinanciado: 0,
    valorPerdido: 0,
    qtdPerdido: 0,
    pipelineAberto: 0,
  },
  serieMensal: [],
  rankingVendedores: [],
  rankingProdutos: [],
  rankingCidades: [],
  origensLead: [],
  financiamentoBancos: [],
  tiposCliente: [],
  motivosPerda: [],
  resumoAnual: [],
};

/**
 * Busca a visão consolidada no banco. A agregação é exclusivamente server-side:
 * em caso de falha, o React Query preserva o último resultado em cache e expõe
 * o erro, sem baixar tabelas do schema mirror para cálculo no navegador.
 */
export async function fetchDesempenhoVendas(
  options: DesempenhoVendasFilterOptions = {}
): Promise<DesempenhoVendasData> {
  const params: Record<string, unknown> = {};
  if (options.from) params.p_from = options.from;
  if (options.to) params.p_to = options.to;
  if (options.ano) params.p_ano = options.ano;
  if (options.vendedor) params.p_vendedor = options.vendedor;
  if (options.cidade) params.p_cidade = options.cidade;
  if (options.condicao) params.p_condicao = options.condicao;
  if (options.produto) params.p_produto = options.produto;
  if (options.origem) params.p_origem = options.origem;
  if (options.banco) params.p_banco = options.banco;
  if (options.motivoPerda) params.p_motivo_perda = options.motivoPerda;

  const { data, error } = await supabase.rpc("rpc_desempenho_vendas_bi", params);
  if (error) throw error;
  if (!data) return EMPTY_DESEMPENHO_DATA;

  const raw = (Array.isArray(data) ? data[0] : data) as Partial<DesempenhoVendasData>;
  return {
    ...EMPTY_DESEMPENHO_DATA,
    ...raw,
    kpis: { ...EMPTY_DESEMPENHO_DATA.kpis, ...raw.kpis },
    serieMensal: raw.serieMensal ?? [],
    rankingProdutos: raw.rankingProdutos ?? [],
    perdas: raw.perdas,
  };
}
