import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { type DateRange } from "react-day-picker";
import { fetchCarteira, type CarteiraRow } from "@/services/bi/adminBIService";
import { fetchParqueBI, type ParqueRow } from "@/services/bi/produtosBIService";
import { toISODate } from "@/lib/dateUtils";
import { useComercialData } from "@/hooks/useComercialData";

type Trend = "up" | "down" | "neutral";

export interface KPIWithPrev {
  value: number;
  previousValue: number;
  trend: Trend;
}

export interface ClientesKPIs {
  clientesAtivos: KPIWithPrev;
  prospects: KPIWithPrev;
  parqueMaquinas: KPIWithPrev;
  coberturaComercial: KPIWithPrev;
}

export interface UseClientesKPIsResult {
  kpis: ClientesKPIs;
  isLoading: boolean;
}

const isProspect = (v: string | null): boolean =>
  /sim|s|prospect|true|1/i.test((v ?? "").trim());

/** Dedupe by CLI_idCliente keeping first occurrence. */
function dedupeClientes(rows: CarteiraRow[]): CarteiraRow[] {
  const seen = new Set<string>();
  const out: CarteiraRow[] = [];
  for (const r of rows) {
    const key = r.CLI_idCliente != null ? String(r.CLI_idCliente) : "";
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(r);
  }
  return out;
}

function makeStaticKPI(value: number): KPIWithPrev {
  return { value, previousValue: value, trend: "neutral" };
}

function calcTrend(atual: number, anterior: number): Trend {
  if (atual > anterior) return "up";
  if (atual < anterior) return "down";
  return "neutral";
}

/**
 * Hook for the CLIENTES section of the Painel BI.
 *
 * Returns 4 KPIs:
 * - clientesAtivos: count of non-prospect clients (static)
 * - prospects: count of prospect clients (static)
 * - parqueMaquinas: total installed machines across all clients (static)
 * - coberturaComercial: % of active clients with at least 1 action in the period
 */
export function useClientesKPIs(dateRange: DateRange | undefined): UseClientesKPIsResult {
  const carteiraQ = useQuery({
    queryKey: ["bi-carteira"],
    queryFn: fetchCarteira,
    staleTime: 5 * 60_000,
  });

  const parqueQ = useQuery({
    queryKey: ["bi-parque"],
    queryFn: fetchParqueBI,
    staleTime: 5 * 60_000,
  });

  // Cobertura: registros do periodo atual filtrados server-side
  const from = toISODate(dateRange?.from);
  const to = toISODate(dateRange?.to ?? dateRange?.from);
  const fetchOptions = (from || to) ? { from, to } : undefined;
  const { allData, isLoading: comercialLoading } = useComercialData(undefined, undefined, fetchOptions);

  const kpis = useMemo((): ClientesKPIs => {
    const rawCarteira = carteiraQ.data ?? [];
    const carteira = dedupeClientes(rawCarteira);
    const parqueRows = parqueQ.data ?? [];

    // Static KPIs
    let ativos = 0;
    let prospects = 0;
    for (const r of carteira) {
      if (isProspect(r.CLI_Prospect)) {
        prospects++;
      } else {
        ativos++;
      }
    }

    let totalMaquinas = 0;
    for (const r of parqueRows) {
      totalMaquinas += r.PQM_QtdMaquinas ?? 0;
    }

    // Cobertura Comercial: % of active clients with actions in dateRange
    const registros = allData?.registrosRecentes ?? [];
    let filteredRegistros = registros;

    if (dateRange?.from) {
      const from = dateRange.from.getTime();
      const to = dateRange.to ? dateRange.to.getTime() : from;
      filteredRegistros = registros.filter((r) => {
        if (!r.dtConclusao) return false;
        const t = new Date(r.dtConclusao).getTime();
        return t >= from && t <= to + 86_399_999;
      });
    }

    const clientesComAcao = new Set<string>();
    for (const r of filteredRegistros) {
      if (r.cliente) {
        clientesComAcao.add(r.cliente);
      }
    }

    const cobertura = ativos > 0
      ? Math.round((clientesComAcao.size / ativos) * 100)
      : 0;

    // For cobertura, calculate previous period (shift dateRange back by same duration)
    let coberturaPrev = cobertura;
    if (dateRange?.from) {
      const from = dateRange.from;
      const to = dateRange.to ?? dateRange.from;
      const durationMs = to.getTime() - from.getTime();
      const prevTo = new Date(from.getTime() - 1);
      const prevFrom = new Date(prevTo.getTime() - durationMs);

      const prevFromTime = prevFrom.getTime();
      const prevToTime = prevTo.getTime();

      const prevRegistros = registros.filter((r) => {
        if (!r.dtConclusao) return false;
        const t = new Date(r.dtConclusao).getTime();
        return t >= prevFromTime && t <= prevToTime + 86_399_999;
      });

      const prevClientesComAcao = new Set<string>();
      for (const r of prevRegistros) {
        if (r.cliente) prevClientesComAcao.add(r.cliente);
      }

      coberturaPrev = ativos > 0
        ? Math.round((prevClientesComAcao.size / ativos) * 100)
        : 0;
    }

    return {
      clientesAtivos: makeStaticKPI(ativos),
      prospects: makeStaticKPI(prospects),
      parqueMaquinas: makeStaticKPI(totalMaquinas),
      coberturaComercial: {
        value: cobertura,
        previousValue: coberturaPrev,
        trend: calcTrend(cobertura, coberturaPrev),
      },
    };
  }, [carteiraQ.data, parqueQ.data, allData, dateRange]);

  const isLoading = carteiraQ.isLoading || parqueQ.isLoading || comercialLoading;

  return { kpis, isLoading };
}
