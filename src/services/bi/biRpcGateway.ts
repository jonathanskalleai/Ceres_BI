import { supabase } from "@/integrations/supabase/client";
import { fetchBiRpc, isBiApiEnabled } from "@/services/bi/biApiTransport";

export interface BiRpcResult<T> {
  data: T | null;
  error: { message: string } | null;
}

/** Shared gateway seam; production BI never bypasses the Python API. */
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
  const legacyFallback = import.meta.env.DEV
    || String(import.meta.env.VITE_BI_LEGACY_RPC_FALLBACK ?? "").toLowerCase() === "true";
  if (legacyFallback) return await supabase.rpc(rpcName, params) as BiRpcResult<T>;
  return {
    data: null,
    error: { message: "A API BI está desabilitada para este build; habilite o gateway Python." },
  };
}
