import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { format } from "date-fns";
import { fetchNegociosCrm } from "@/services/negociosCrmRpcService";
import type { RpcNegociosCrmResult } from "@/types/negociosCrm";
import type { DateRange } from "react-day-picker";

const STALE_TIME = 5 * 60_000;

interface UseNegociosCrmOptions {
  dateRange: DateRange | undefined;
  cidade?: string;
  vendedor?: string;
}

/**
 * Fetches negocios dashboard data from rpc_negocios_crm.
 * Accepts filter params explicitly — works in both CRM and BI contexts.
 */
export function useNegociosCrm({ dateRange, cidade, vendedor }: UseNegociosCrmOptions) {
  const from = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
  const to = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;

  return useQuery<RpcNegociosCrmResult, Error>({
    queryKey: ["rpc", "negocios-crm", from ?? null, to ?? null, cidade || null, vendedor || null],
    queryFn: () => fetchNegociosCrm(from, to, cidade || undefined, vendedor || undefined),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
  });
}
