import { invokeBiRpc } from "@/services/bi/biRpcGateway";
import type { NegociosExpandidoResponse } from "@/types/bi/negociosExpandido";

interface FetchOptions {
  pFrom: string;
  pTo: string;
  pVendedor?: string;
  pCidade?: string;
}

export async function fetchNegociosExpandido({
  pFrom,
  pTo,
  pVendedor,
  pCidade,
}: FetchOptions): Promise<NegociosExpandidoResponse> {
  const { data, error } = await invokeBiRpc("rpc_negocios_bi_expandido", {
    p_from: pFrom,
    p_to: pTo,
    p_vendedor: pVendedor ?? null,
    p_cidade: pCidade ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? {}) as NegociosExpandidoResponse;
}
