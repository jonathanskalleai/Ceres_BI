import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RpcEvolucaoGPO {
  mes: string;
  oportunidades: number;
  ganhos: number;
  perdidos: number;
  valor_ganho: number;
  valor_perdido: number;
  valor_oportunidades: number;
}

async function fetchEvolucaoGPO(
  vendedor?: string,
  from?: string,
  to?: string,
): Promise<RpcEvolucaoGPO[]> {
  const params: Record<string, unknown> = {
    p_vendedor: vendedor ?? null,
    p_from: from ?? null,
    p_to: to ?? null,
  };

  const { data, error } = await supabase.rpc("rpc_evolucao_ganhos_perdidos_12m", params);
  if (error) throw new Error(`[useEvolucaoGPO] ${error.message}`);
  return (data ?? []) as RpcEvolucaoGPO[];
}

const STALE_TIME = 5 * 60_000;

interface UseEvolucaoGPOOptions {
  vendedor?: string;
  from?: string;
  to?: string;
  enabled?: boolean;
}

export function useEvolucaoGPO({ vendedor, from, to, enabled = true }: UseEvolucaoGPOOptions) {
  return useQuery<RpcEvolucaoGPO[], Error>({
    queryKey: ["rpc", "evolucao-gpo-12m", vendedor ?? null, from ?? null, to ?? null],
    queryFn: () => fetchEvolucaoGPO(vendedor, from, to),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}
