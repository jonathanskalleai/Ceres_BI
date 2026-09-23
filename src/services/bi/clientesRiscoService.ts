import { invokeBiRpc } from "@/services/bi/biRpcGateway";
import type { RpcClientesCriticosBI, RpcClientesRisco } from "@/types/biRpc";

function unwrapRpc<T>(data: unknown): T {
  return (Array.isArray(data) ? data[0] : data) as T;
}

/** Client risk distribution by days since the last action. */
export async function fetchClientesRisco(params: {
  vendedor?: string;
  cidade?: string;
}): Promise<RpcClientesRisco> {
  try {
    const rpcParams: Record<string, unknown> = {};
    if (params.vendedor) rpcParams.p_vendedor = params.vendedor;
    if (params.cidade) rpcParams.p_cidade = params.cidade;

    const { data, error } = await invokeBiRpc("rpc_acoes_clientes_risco", rpcParams);
    if (error) throw new Error(error.message);

    const raw = unwrapRpc<Partial<RpcClientesRisco> | null>(data);
    return {
      faixas: raw?.faixas ?? [],
      totalCarteira: raw?.totalCarteira ?? 0,
      clientesComAcao: raw?.clientesComAcao ?? 0,
      clientesSemAcao: raw?.clientesSemAcao ?? 0,
    };
  } catch (err) {
    throw new Error(`[clientesRiscoService.fetchClientesRisco] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/** Clients with a completed action older than the selected threshold. */
export async function fetchClientesCriticos(params: {
  vendedor?: string;
  cidade?: string;
  diasMin?: number;
  limit?: number;
}): Promise<RpcClientesCriticosBI> {
  try {
    const rpcParams = {
      p_vendedor: params.vendedor ?? null,
      p_cidade: params.cidade ?? null,
      p_dias_min: params.diasMin ?? 365,
      p_limit: params.limit ?? 5,
    };

    const { data, error } = await invokeBiRpc("rpc_clientes_criticos_bi", rpcParams);
    if (error) throw new Error(error.message);

    const raw = unwrapRpc<Partial<RpcClientesCriticosBI> | null>(data);
    return {
      totalCriticos: Number(raw?.totalCriticos ?? 0),
      semAcaoRegistrada: Number(raw?.semAcaoRegistrada ?? 0),
      valorEmRisco: Number(raw?.valorEmRisco ?? 0),
      rows: raw?.rows ?? [],
    };
  } catch (err) {
    throw new Error(`[clientesRiscoService.fetchClientesCriticos] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}
