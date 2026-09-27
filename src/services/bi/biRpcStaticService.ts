import { invokeBiRpc } from "@/services/bi/biRpcGateway";
import {
  OPERACIONAL_BI_DEFAULTS,
  PARQUE_BI_DEFAULTS,
  PRODUTOS_BI_DEFAULTS,
} from "@/services/bi/biRpcDefaults";
import { normalizeRpcObject } from "@/services/bi/biResponseNormalize";
import type { RpcOperacionalBI, RpcParqueRenovacaoBI, RpcProdutosBI } from "@/types/biRpc";

/** Static/current-position BI RPC adapters kept separate from period queries. */
export async function fetchParqueRenovacaoBI(cutoffAnos?: number): Promise<RpcParqueRenovacaoBI> {
  try {
    const { data, error } = await invokeBiRpc("rpc_parque_renovacao_bi", {
      p_cutoff_anos: cutoffAnos ?? 5,
    });
    if (error) throw new Error(error.message);
    return normalizeRpcObject(data, PARQUE_BI_DEFAULTS, [], ["frotaRenovacao"], "rpc_parque_renovacao_bi");
  } catch (err) {
    throw new Error(`[biRpcStaticService.fetchParqueRenovacaoBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

export async function fetchOperacionalBI(): Promise<RpcOperacionalBI> {
  try {
    const { data, error } = await invokeBiRpc("rpc_operacional_bi");
    if (error) throw new Error(error.message);
    return normalizeRpcObject(
      data,
      OPERACIONAL_BI_DEFAULTS,
      ["kpis"],
      ["kmPorTecnico", "utilizacaoPorTecnico", "agendaPorStatus", "agendaPorTipo"],
      "rpc_operacional_bi",
    );
  } catch (err) {
    throw new Error(`[biRpcStaticService.fetchOperacionalBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

export async function fetchProdutosBI(): Promise<RpcProdutosBI> {
  try {
    const { data, error } = await invokeBiRpc("rpc_produtos_bi");
    if (error) throw new Error(error.message);
    return normalizeRpcObject(
      data,
      PRODUTOS_BI_DEFAULTS,
      ["kpis"],
      ["porGrupo", "porMarca", "topModelos"],
      "rpc_produtos_bi",
    );
  } catch (err) {
    throw new Error(`[biRpcStaticService.fetchProdutosBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}
