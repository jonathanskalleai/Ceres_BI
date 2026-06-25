import { type DateRange } from "react-day-picker";
import { useAdminBIRpc } from "@/hooks/bi/useAdminBIRpc";
import type { KPIWithPrev, ClientesKPIs, UseClientesKPIsResult } from "@/types/clientesKpis";

function neutralKPI(value: number): KPIWithPrev {
  return { value, previousValue: 0, trend: "neutral" };
}

/**
 * RPC-backed replacement for useClientesKPIs.
 * Fetches KPIs from rpc_admin_bi (server-side aggregation).
 *
 * Notes:
 * - rpc_admin_bi is a snapshot (no date filtering needed).
 * - coberturaComercial (% of clients with actions in period) is not available
 *   from this RPC; set to 0 for now — dedicated RPC needed later.
 * - parqueMaquinas also not in rpc_admin_bi; set to 0.
 * - Trend hardcoded to "neutral" (no previous-period data from RPC).
 */
export function useClientesKPIsRpc(
  _dateRange: DateRange | undefined,
): UseClientesKPIsResult {
  const { data, isLoading } = useAdminBIRpc();

  const kpis: ClientesKPIs = data
    ? {
        clientesAtivos: neutralKPI(data.kpis.ativos),
        prospects: neutralKPI(data.kpis.prospects),
        parqueMaquinas: neutralKPI(0), // Not in rpc_admin_bi yet
        coberturaComercial: neutralKPI(0), // Needs dedicated RPC
      }
    : {
        clientesAtivos: neutralKPI(0),
        prospects: neutralKPI(0),
        parqueMaquinas: neutralKPI(0),
        coberturaComercial: neutralKPI(0),
      };

  return { kpis, isLoading };
}
