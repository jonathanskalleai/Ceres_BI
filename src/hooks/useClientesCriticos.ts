import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 5 * 60_000; // 5 minutes

/** Row returned by rpc_clientes_criticos */
export interface RpcClienteCritico {
  cli_nome: string;
  emp_cidade: string;
  aco_vendedor: string;
  dias_sem_contato: number;
  ultima_acao_data: string;
  total_acoes: number;
  total_visitas: number;
  pipeline: number;
  ultima_obs: string | null;
  ultimo_tipo_acao: string | null;
}

interface UseClientesCriticosOptions {
  diasLimite?: number;
  enabled?: boolean;
}

async function fetchClientesCriticos(diasLimite: number): Promise<RpcClienteCritico[]> {
  const { data, error } = await supabase.rpc("rpc_clientes_criticos", {
    p_dias_limite: diasLimite,
  });
  if (error) throw new Error(`rpc_clientes_criticos: ${error.message}`);
  return (data ?? []) as RpcClienteCritico[];
}

export function useClientesCriticos({ diasLimite = 60, enabled = true }: UseClientesCriticosOptions = {}) {
  return useQuery<RpcClienteCritico[], Error>({
    queryKey: ["rpc", "clientes-criticos", diasLimite],
    queryFn: () => fetchClientesCriticos(diasLimite),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}
