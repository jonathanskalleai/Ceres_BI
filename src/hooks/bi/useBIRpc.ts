import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 5 * 60_000; // 5 minutes

/**
 * Generic factory hook for Supabase RPC calls.
 * Reduces boilerplate across BI hooks by encapsulating the common pattern:
 * queryKey construction, supabase.rpc call, error handling, stale time.
 *
 * For hooks with extra logic (transforms, complex enabled conditions),
 * use this as the inner fetcher and wrap with custom logic.
 */
export function useBIRpc<T>(
  rpcName: string,
  params: Record<string, unknown>,
  enabled = true,
) {
  return useQuery<T, Error>({
    queryKey: ["rpc", rpcName, params],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc(rpcName, params);
        if (error) throw new Error(error.message);
        return data as T;
      } catch (err) {
        throw new Error(`[useBIRpc.${rpcName}] ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    },
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}
