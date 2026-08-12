import { supabase } from "@/integrations/supabase/client";
import type { RpcAcoesTermometroFechamento } from "@/types/biRpc";

const DEFAULTS: RpcAcoesTermometroFechamento = {
  resumo: {
    negocios: 0,
    clientes: 0,
    valorBruto: 0,
    valorPonderado: 0,
    negociosQuentes: 0,
    valorQuente: 0,
  },
  faixas: [],
  prioridades: [],
};

/** Supabase pode embrulhar o JSON de uma RPC em uma lista de uma posição. */
function unwrapRpc<T>(data: unknown): T {
  return (Array.isArray(data) ? data[0] : data) as T;
}

/**
 * Carteira aberta priorizada por NGO_Probabilidade.
 *
 * A RPC devolve apenas o resumo, as seis faixas e até 50 prioridades: a tela
 * nao transfere a carteira inteira somente para desenhar esse card.
 */
export async function fetchAcoesTermometroFechamento(params: {
  from?: string;
  to?: string;
  vendedor?: string;
  cidade?: string;
  escopo: "ativos_periodo" | "carteira_total";
}): Promise<RpcAcoesTermometroFechamento> {
  try {
    const rpcParams: Record<string, unknown> = { p_escopo: params.escopo };
    if (params.from) rpcParams.p_from = params.from;
    if (params.to) rpcParams.p_to = params.to;
    if (params.vendedor) rpcParams.p_vendedor = params.vendedor;
    if (params.cidade) rpcParams.p_cidade = params.cidade;

    const { data, error } = await supabase.rpc("rpc_acoes_termometro_fechamento", rpcParams);
    if (error) throw new Error(error.message);

    const raw = unwrapRpc<Partial<RpcAcoesTermometroFechamento> | null>(data);
    return {
      resumo: { ...DEFAULTS.resumo, ...raw?.resumo },
      faixas: raw?.faixas ?? [],
      prioridades: raw?.prioridades ?? [],
    };
  } catch (err) {
    throw new Error(
      `[acoesTermometroService.fetchAcoesTermometroFechamento] ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  }
}
