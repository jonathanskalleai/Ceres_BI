import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchCarteira, fetchOrgCounts,
  type CarteiraRow,
} from "@/services/bi/adminBIService";

interface ChartDatum {
  name: string;
  value: number;
}

interface AdminKPIs {
  totalClientes: number;
  prospects: number;
  ativos: number;
  ufsCobertas: number;
  consultoresCarteira: number;
  empresas: number;
}

export interface AdminAgg {
  kpis: AdminKPIs;
  prospectVsAtivo: ChartDatum[];
  porTipoCliente: ChartDatum[];
  porUF: ChartDatum[];
  porConsultor: ChartDatum[];
}

/** Mantem uma linha por cliente (CLI_idCliente) para contagens corretas. */
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

const isProspect = (v: string | null): boolean => /sim|s|prospect|true|1/i.test((v ?? "").trim());

export function aggregateAdmin(rawRows: CarteiraRow[], empresas: number): AdminAgg {
  const rows = dedupeClientes(rawRows);

  let prospects = 0;
  let ativos = 0;
  const tipoMap = new Map<string, number>();
  const ufMap = new Map<string, number>();
  const consultorMap = new Map<string, number>();

  for (const r of rows) {
    if (isProspect(r.CLI_Prospect)) prospects++;
    else ativos++;

    const tipo = (r.CLI_TipoCliente || "Sem classificacao").trim() || "Sem classificacao";
    tipoMap.set(tipo, (tipoMap.get(tipo) ?? 0) + 1);

    const uf = (r.CLI_UF || "N/A").trim() || "N/A";
    ufMap.set(uf, (ufMap.get(uf) ?? 0) + 1);

    const consultor = (r.USR_NomeUsuario || "Sem consultor").trim() || "Sem consultor";
    consultorMap.set(consultor, (consultorMap.get(consultor) ?? 0) + 1);
  }

  const toChart = (m: Map<string, number>, top = 10) =>
    Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, top);

  const kpis: AdminKPIs = {
    totalClientes: rows.length,
    prospects,
    ativos,
    ufsCobertas: ufMap.size,
    consultoresCarteira: consultorMap.size,
    empresas,
  };

  return {
    kpis,
    prospectVsAtivo: [
      { name: "Clientes Ativos", value: ativos },
      { name: "Prospects", value: prospects },
    ],
    porTipoCliente: toChart(tipoMap),
    porUF: toChart(ufMap),
    porConsultor: toChart(consultorMap),
  };
}

export function useAdminData(enabled: boolean) {
  const carteiraQ = useQuery({ queryKey: ["bi-carteira"], queryFn: fetchCarteira, staleTime: 60_000, enabled });
  const orgQ = useQuery({ queryKey: ["bi-org-counts"], queryFn: fetchOrgCounts, staleTime: 60_000, enabled });

  const agg = useMemo(
    () => aggregateAdmin(carteiraQ.data ?? [], orgQ.data?.empresas ?? 0),
    [carteiraQ.data, orgQ.data],
  );

  return { agg, isLoading: carteiraQ.isLoading || orgQ.isLoading };
}
