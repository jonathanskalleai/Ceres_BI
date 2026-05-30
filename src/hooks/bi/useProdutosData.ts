import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchParqueBI, type ParqueRow } from "@/services/bi/produtosBIService";

interface ParqueDatum {
  name: string;
  value: number; // quantidade de maquinas
}

interface ParqueKPIs {
  totalMaquinas: number;
  clientesComParque: number;
  gruposDistintos: number;
  marcasDistintas: number;
}

export interface ParqueAgg {
  kpis: ParqueKPIs;
  porGrupo: ParqueDatum[];
  porMarca: ParqueDatum[];
  topModelos: ParqueDatum[];
}

const qtd = (v: number | null): number => (typeof v === "number" && isFinite(v) && v > 0 ? v : 1);

function topSum(map: Map<string, number>, top = 10): ParqueDatum[] {
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, top);
}

export function aggregateParque(rows: ParqueRow[]): ParqueAgg {
  const grupoMap = new Map<string, number>();
  const marcaMap = new Map<string, number>();
  const modeloMap = new Map<string, number>();
  const clientes = new Set<string>();
  let totalMaquinas = 0;

  for (const r of rows) {
    const q = qtd(r.PQM_QtdMaquinas);
    totalMaquinas += q;
    if (r.CLI_idCliente != null) clientes.add(String(r.CLI_idCliente));

    const grupo = (r.PQM_Grupo || "Sem grupo").trim() || "Sem grupo";
    grupoMap.set(grupo, (grupoMap.get(grupo) ?? 0) + q);

    const marca = (r.PQM_Marca || "Sem marca").trim() || "Sem marca";
    marcaMap.set(marca, (marcaMap.get(marca) ?? 0) + q);

    const modelo = (r.PQM_Modelo || "Sem modelo").trim() || "Sem modelo";
    modeloMap.set(modelo, (modeloMap.get(modelo) ?? 0) + q);
  }

  return {
    kpis: {
      totalMaquinas,
      clientesComParque: clientes.size,
      gruposDistintos: grupoMap.size,
      marcasDistintas: marcaMap.size,
    },
    porGrupo: topSum(grupoMap),
    porMarca: topSum(marcaMap),
    topModelos: topSum(modeloMap),
  };
}

export function useProdutosData(enabled: boolean) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["bi-parque"],
    queryFn: fetchParqueBI,
    staleTime: 60_000,
    enabled,
  });

  const agg = useMemo(() => aggregateParque(rows), [rows]);

  return { agg, isLoading };
}
