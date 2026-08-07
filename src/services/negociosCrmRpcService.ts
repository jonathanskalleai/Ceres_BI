import { supabase } from "@/integrations/supabase/client";
import type { RpcNegociosCrmResult, RpcNegociosSummary } from "@/types/negociosCrm";

/**
 * Calls rpc_negocios_crm — returns full negocios dashboard data as JSON.
 * The RPC returns a flat JSON with summary fields + arrays at root level.
 * We restructure into { summary, evolucaoMensal, porConsultor, porRegiao, porTipo }.
 */
export async function fetchNegociosCrm(
  from: string | undefined,
  to: string | undefined,
  cidade?: string,
  vendedor?: string,
): Promise<RpcNegociosCrmResult> {
  try {
    const params: Record<string, unknown> = {
      p_from: from || null,
      p_to: to || null,
    };
    if (cidade) params.p_cidade = cidade;
    if (vendedor) params.p_vendedor = vendedor;

    const { data, error } = await supabase.rpc("rpc_negocios_crm", params);
    if (error) throw new Error(error.message);

    // RPC returns a single JSON value; normalize if wrapped in array
    const raw = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;

    // Restructure flat response into typed result
    const summary: RpcNegociosSummary = {
      totalNegocios: (raw.totalNegocios as number) ?? 0,
      totalValor: (raw.totalValor as number) ?? 0,
      ticketMedio: (raw.ticketMedio as number) ?? 0,
      ganhos: (raw.ganhos as number) ?? 0,
      emAndamento: (raw.emAndamento as number) ?? 0,
      perdidos: (raw.perdidos as number) ?? 0,
      taxaConversao: (raw.taxaConversao as number) ?? 0,
      clientesAtendidos: (raw.clientesAtendidos as number) ?? 0,
      totalRecebido: (raw.totalRecebido as number) ?? 0,
      totalUsado: (raw.totalUsado as number) ?? 0,
      percentUsado: (raw.percentUsado as number) ?? 0,
    };

    return {
      summary,
      evolucaoMensal: (raw.evolucaoMensal as RpcNegociosCrmResult["evolucaoMensal"]) ?? [],
      porConsultor: (raw.porConsultor as RpcNegociosCrmResult["porConsultor"]) ?? [],
      porRegiao: (raw.porRegiao as RpcNegociosCrmResult["porRegiao"]) ?? [],
      porTipo: (raw.porTipo as RpcNegociosCrmResult["porTipo"]) ?? [],
    };
  } catch (err) {
    throw new Error(`[negociosCrmRpcService.fetchNegociosCrm] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}
