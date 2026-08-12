import { supabase } from "@/integrations/supabase/client";

/** Unwrap Supabase RPC response — single-JSON RPCs may return wrapped in array. */
function unwrapRpc<T>(data: unknown): T {
  const raw = Array.isArray(data) ? data[0] : data;
  return raw as T;
}

export interface NegocioPerdidoRow {
  negocioNumero: string;
  cliente: string;
  cidade: string;
  consultor: string;
  produto: string | null;
  observacaoNegocio: string | null;
  dataFechamento: string;
  /** Alias para `valorPerdido` retornado pela RPC (valor negociado do negocio perdido). */
  valorPerdido: number;
}

export interface RpcNegociosPerdidos {
  rows: NegocioPerdidoRow[];
  total: number;
}

/**
 * Calls rpc_acoes_negocios_perdidos — negócios perdidos no período (Story 4-B drill-down).
 *
 * Grão: 1 linha por negócio único (DISTINCT ON ngo_numero), antes de LIMIT.
 * Cliente resolvido via subquery LIMIT 1 (sem JOIN multiplicador).
 * Ordenação: dataFechamento DESC (determinística antes de LIMIT/OFFSET).
 */
export async function fetchAcoesNegociosPerdidos(params: {
  from?: string;
  to?: string;
  vendedor?: string;
  cidade?: string;
  limit?: number;
  offset?: number;
}): Promise<RpcNegociosPerdidos> {
  try {
    const rpcParams: Record<string, unknown> = {};
    if (params.from) rpcParams.p_from = params.from;
    if (params.to) rpcParams.p_to = params.to;
    if (params.vendedor) rpcParams.p_vendedor = params.vendedor;
    if (params.cidade) rpcParams.p_cidade = params.cidade;
    if (params.limit != null) rpcParams.p_limit = params.limit;
    if (params.offset != null) rpcParams.p_offset = params.offset;

    const { data, error } = await supabase.rpc("rpc_acoes_negocios_perdidos", rpcParams);
    if (error) throw new Error(error.message);

    const raw = unwrapRpc<Partial<RpcNegociosPerdidos> | null>(data);
    return { rows: raw?.rows ?? [], total: raw?.total ?? 0 };
  } catch (err) {
    throw new Error(
      `[acoesNegociosPerdidosService.fetchAcoesNegociosPerdidos] ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  }
}
