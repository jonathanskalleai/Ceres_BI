import { supabase } from "@/integrations/supabase/client";

/** Unwrap Supabase RPC response — single-JSON RPCs may return wrapped in array. */
function unwrapRpc<T>(data: unknown): T {
  const raw = Array.isArray(data) ? data[0] : data;
  return raw as T;
}

export interface AcoesEmAndamentoRow {
  negocioNumero: string;
  cliente: string;
  cidade: string;
  consultor: string;
  etapa: string | null;
  valor: number | null;
  ultimaAcao: string | null;
  dataUltimaAcao: string | null;
  /** Dias desde a última ação. Ordenação da RPC: diasParado DESC. */
  diasParado: number;
}

export interface RpcEmAndamento {
  rows: AcoesEmAndamentoRow[];
  total: number;
}

/**
 * Calls rpc_acoes_em_andamento — negócios em andamento (Story 5-A drill-down).
 *
 * Grão: 1 linha por negócio (CTE canônico deduplicado antes de LIMIT/OFFSET).
 * Cliente resolvido via subquery LIMIT 1 (sem JOIN multiplicador com carteira).
 * Ordenação: diasParado DESC, negocioNumero ASC (desempate estável).
 * Destaque: diasParado > 90 → valor em vermelho (mesma convenção do mapa).
 */
export async function fetchAcoesEmAndamento(params: {
  from?: string;
  to?: string;
  vendedor?: string;
  cidade?: string;
  limit?: number;
  offset?: number;
}): Promise<RpcEmAndamento> {
  try {
    const rpcParams: Record<string, unknown> = {};
    if (params.from) rpcParams.p_from = params.from;
    if (params.to) rpcParams.p_to = params.to;
    if (params.vendedor) rpcParams.p_vendedor = params.vendedor;
    if (params.cidade) rpcParams.p_cidade = params.cidade;
    if (params.limit != null) rpcParams.p_limit = params.limit;
    if (params.offset != null) rpcParams.p_offset = params.offset;

    const { data, error } = await supabase.rpc("rpc_acoes_em_andamento", rpcParams);
    if (error) throw new Error(error.message);

    const raw = unwrapRpc<Partial<RpcEmAndamento> | null>(data);
    return { rows: raw?.rows ?? [], total: raw?.total ?? 0 };
  } catch (err) {
    throw new Error(
      `[acoesEmAndamentoService.fetchAcoesEmAndamento] ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  }
}
