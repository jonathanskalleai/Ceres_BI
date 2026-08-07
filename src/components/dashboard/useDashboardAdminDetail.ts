// useDashboardAdminDetail.ts — Logic hook for DashboardAdminDetail

import { useMemo, useState } from "react";
import { Registro } from "@/types/comercial";

interface AdminDetailStats {
  visitas: number;
  clientes: number;
  cidades: number;
  tiposCount: Record<string, number>;
  topClientes: [string, number][];
}

export function useDashboardAdminDetail(registros: Registro[]) {
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoAcaoFilter, setTipoAcaoFilter] = useState("all");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const tiposAcao = useMemo(() => {
    const set = new Set<string>();
    registros.forEach((r) => r.tipoAcao && set.add(r.tipoAcao));
    return Array.from(set).sort();
  }, [registros]);

  const filtered = useMemo(() => {
    let result = registros;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.cliente?.toLowerCase().includes(term) ||
          r.obs?.toLowerCase().includes(term) ||
          r.cidade?.toLowerCase().includes(term)
      );
    }
    if (tipoAcaoFilter !== "all") {
      result = result.filter((r) => r.tipoAcao === tipoAcaoFilter);
    }
    return result.sort((a, b) => (b.dtConclusao || "").localeCompare(a.dtConclusao || ""));
  }, [registros, searchTerm, tipoAcaoFilter]);

  const stats: AdminDetailStats = useMemo(() => {
    const visitas = registros.filter((r) => r.tipoContato?.toLowerCase().includes("visita")).length;
    const clientes = new Set(registros.map((r) => r.cliente).filter(Boolean)).size;
    const cidades = new Set(registros.map((r) => r.cidade).filter(Boolean)).size;
    const tiposCount: Record<string, number> = {};
    registros.forEach((r) => {
      if (r.tipoAcao) tiposCount[r.tipoAcao] = (tiposCount[r.tipoAcao] || 0) + 1;
    });
    const clienteAcoes: Record<string, number> = {};
    registros.forEach((r) => {
      if (r.cliente) clienteAcoes[r.cliente] = (clienteAcoes[r.cliente] || 0) + 1;
    });
    const topClientes = Object.entries(clienteAcoes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8) as [string, number][];
    return { visitas, clientes, cidades, tiposCount, topClientes };
  }, [registros]);

  return {
    searchTerm,
    setSearchTerm,
    tipoAcaoFilter,
    setTipoAcaoFilter,
    expandedRow,
    setExpandedRow,
    tiposAcao,
    filtered,
    stats,
  };
}

export function truncateObs(obs: string | undefined, max = 80): string {
  if (!obs) return "—";
  return obs.length > max ? obs.slice(0, max) + "…" : obs;
}
