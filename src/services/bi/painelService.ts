import { fetchBiApi } from "@/services/bi/biApiTransport";
import type { PainelKPIs } from "@/hooks/bi/usePainelKPIsRpc";

export interface PainelKpisFilters {
  from: string;
  to: string;
  funis?: string[];
  vendedor?: string;
  cidade?: string;
}

/** Fetch the server-composed panel contract; no KPI joins happen in React. */
export async function fetchPainelKPIs(filters: PainelKpisFilters): Promise<PainelKPIs> {
  return fetchBiApi<PainelKPIs>("/painel/kpis", filters);
}
