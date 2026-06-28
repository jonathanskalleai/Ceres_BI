import { useMemo } from "react";
import { type DateRange } from "react-day-picker";
import { useAdminBIRpc } from "@/hooks/bi/useAdminBIRpc";
import { useProdutosBIRpc } from "@/hooks/bi/useProdutosBIRpc";
import type { KPIWithPrev, ClientesKPIs, UseClientesKPIsResult } from "@/types/clientesKpis";

function neutralKPI(value: number): KPIWithPrev {
  return { value, previousValue: 0, trend: "neutral" };
}

/**
 * RPC-backed replacement for useClientesKPIs.
 * Fetches KPIs from rpc_admin_bi (snapshot) + rpc_produtos_bi (parque).
 *
 * Notes:
 * - rpc_admin_bi is a snapshot (no date filtering) → no period comparison possible.
 * - coberturaComercial needs a dedicated RPC (set to 0 for now).
 * - parqueMaquinas now comes from rpc_produtos_bi.
 */
export function useClientesKPIsRpc(
  _dateRange: DateRange | undefined,
  cidade?: string,
): UseClientesKPIsResult {
  const { data, isLoading: l1 } = useAdminBIRpc({ cidade });
  const { data: produtos, isLoading: l2 } = useProdutosBIRpc(true);

  const kpis = useMemo((): ClientesKPIs => {
    if (data) {
      return {
        clientesAtivos: neutralKPI(data.kpis.ativos),
        prospects: neutralKPI(data.kpis.prospects),
        parqueMaquinas: neutralKPI(produtos.kpis.totalMaquinas),
        coberturaComercial: neutralKPI(0), // Needs dedicated RPC
      };
    }
    return {
      clientesAtivos: neutralKPI(0),
      prospects: neutralKPI(0),
      parqueMaquinas: neutralKPI(0),
      coberturaComercial: neutralKPI(0),
    };
  }, [data, produtos]);

  return { kpis, isLoading: l1 || l2 };
}
