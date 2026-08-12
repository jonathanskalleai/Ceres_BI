import { supabase } from "@/integrations/supabase/client";
import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";

export interface ConsultoresResumoParams {
  from: string;
  to: string;
  vendedor?: string;
  cidade?: string;
  tipoAcao?: string;
}

/**
 * Resumo por consultor com a mesma regra de carteira e desfechos da tela
 * Acoes. Nao faz re-agregacao de valores no cliente.
 */
export async function fetchConsultoresResumoAcoes({
  from,
  to,
  vendedor,
  cidade,
  tipoAcao,
}: ConsultoresResumoParams): Promise<RpcConsultorResumoAcoes[]> {
  try {
    const { data, error } = await supabase.rpc("rpc_consultores_resumo_acoes", {
      p_from: from,
      p_to: to,
      p_vendedor: vendedor || null,
      p_cidade: cidade || null,
      p_tipo_acao: tipoAcao || null,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as RpcConsultorResumoAcoes[];
  } catch (err) {
    throw new Error(
      `[consultoresRpcService.fetchConsultoresResumoAcoes] ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  }
}
