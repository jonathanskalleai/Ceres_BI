import { supabase } from "@/integrations/supabase/client";

/** Unwrap Supabase RPC response — single-JSON RPCs may return wrapped in array. */
function unwrapRpc<T>(data: unknown): T {
  const raw = Array.isArray(data) ? data[0] : data;
  return raw as T;
}

export interface PedidoDetalheRow {
  /** Alias para `pedidoCodigo` retornado pela RPC (codigo interno do pedido). */
  pedidoCodigo: string;
  negocioNumero: string;
  cliente: string;
  cidade: string;
  consultor: string;
  produto: string | null;
  observacaoNegocio: string | null;
  dataAprovacao: string;
  valorPedido: number | null;
}

export interface RpcPedidosGanhos {
  rows: PedidoDetalheRow[];
  total: number;
}

/**
 * Calls rpc_acoes_pedidos_ganhos — pedidos aprovados no periodo (Story 4-A drill-down).
 *
 * Grão: 1 linha por pedido único (DISTINCT ON pdo_codigointerno), antes de LIMIT.
 * Cliente resolvido via subquery LIMIT 1 (sem JOIN multiplicador).
 * Ordenação: dataAprovacao DESC (determinística antes de LIMIT/OFFSET).
 */
export async function fetchAcoesPedidosGanhos(params: {
  from?: string;
  to?: string;
  vendedor?: string;
  cidade?: string;
  limit?: number;
  offset?: number;
}): Promise<RpcPedidosGanhos> {
  try {
    const rpcParams: Record<string, unknown> = {};
    if (params.from) rpcParams.p_from = params.from;
    if (params.to) rpcParams.p_to = params.to;
    if (params.vendedor) rpcParams.p_vendedor = params.vendedor;
    if (params.cidade) rpcParams.p_cidade = params.cidade;
    if (params.limit != null) rpcParams.p_limit = params.limit;
    if (params.offset != null) rpcParams.p_offset = params.offset;

    const { data, error } = await supabase.rpc("rpc_acoes_pedidos_ganhos", rpcParams);
    if (error) throw new Error(error.message);

    const raw = unwrapRpc<Partial<RpcPedidosGanhos> | null>(data);
    return { rows: raw?.rows ?? [], total: raw?.total ?? 0 };
  } catch (err) {
    throw new Error(
      `[acoesPedidosGanhosService.fetchAcoesPedidosGanhos] ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  }
}
