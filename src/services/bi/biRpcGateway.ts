import { supabase } from "@/integrations/supabase/client";
import { fetchBiRpc, isBiApiEnabled } from "@/services/bi/biApiTransport";

export interface BiRpcResult<T> {
  data: T | null;
  error: { message: string } | null;
}

/** Shared gateway seam with a safe Supabase fallback while canary is pending. */
export async function invokeBiRpc<T = unknown>(
  rpcName: string,
  params: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<BiRpcResult<T>> {
  if (isBiApiEnabled()) {
    try {
      return { data: await fetchBiRpc<T>(rpcName, params, signal), error: null };
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : "Erro desconhecido na API BI" },
      };
    }
  }
  return await supabase.rpc(rpcName, params) as BiRpcResult<T>;
}
