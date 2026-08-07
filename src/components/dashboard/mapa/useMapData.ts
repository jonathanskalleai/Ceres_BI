import { useMemo } from "react";
import type { Filters, RegiaoSummary, Registro } from "@/types/comercial";
import { MapRegion, ClientePoint, MapViewMode } from "./types";

interface UseMapDataReturn {
  regions: MapRegion[];
  registroPoints: Registro[];
  clientePoints: ClientePoint[];
  alta: MapRegion[];
  media: MapRegion[];
  baixa: MapRegion[];
  center: [number, number];
}

export function useMapData(
  regioes: RegiaoSummary[],
  registros: Registro[],
  filters: Filters,
  mapView: MapViewMode
): UseMapDataReturn {
  const regions = useMemo(() => {
    let filtered = regioes.filter((r: RegiaoSummary) => {
      if (r.lat == null || r.lng == null) return false;
      if (r.lat === 0 && r.lng === 0) return false;
      if (r.lat < -34 || r.lat > 6 || r.lng < -75 || r.lng > -33) return false;
      return true;
    });
    if (filters.cidade) filtered = filtered.filter((r) => r.cidade === filters.cidade);

    const maxAcoes = Math.max(...filtered.map((r) => r.totalAcoes), 1);
    const p33 = maxAcoes * 0.33;
    const p66 = maxAcoes * 0.66;

    return filtered.map((r: RegiaoSummary) => {
      let color: string;
      let level: string;
      if (r.totalAcoes >= p66) {
        color = "#22c55e";
        level = "Alta";
      } else if (r.totalAcoes >= p33) {
        color = "#eab308";
        level = "Média";
      } else {
        color = "#ef4444";
        level = "Baixa";
      }
      return {
        cidade: r.cidade,
        lat: r.lat,
        lng: r.lng,
        totalAcoes: r.totalAcoes,
        clientes: r.clientes,
        pipeline: r.pipeline,
        visitas: r.visitas,
        color,
        level,
      } as MapRegion;
    });
  }, [regioes, filters]);

  const registroPoints = useMemo(() => {
    let regs = registros.filter((r: Registro) => r.lat && r.lng);
    if (filters.dateRange?.from)
      regs = regs.filter((r) => r.dtConclusao && r.dtConclusao >= filters.dateRange!.from);
    if (filters.dateRange?.to)
      regs = regs.filter((r) => r.dtConclusao && r.dtConclusao <= filters.dateRange!.to);
    if (filters.cidade) regs = regs.filter((r) => r.cidade === filters.cidade);
    if (filters.tipoAcao) regs = regs.filter((r) => r.tipoAcao === filters.tipoAcao);
    return regs;
  }, [registros, filters]);

  const clientePoints = useMemo<ClientePoint[]>(() => {
    const grouped = new Map<string, Registro[]>();
    for (const r of registroPoints) {
      const key = r.cliente?.trim();
      if (!key) continue;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(r);
    }

    const points: ClientePoint[] = [];
    for (const [cliente, regs] of grouped) {
      const sorted = [...regs].sort((a, b) => {
        const da = a.dtConclusao || "";
        const db = b.dtConclusao || "";
        return db.localeCompare(da);
      });
      const latest = sorted[0];
      if (latest.lat && latest.lng) {
        points.push({
          cliente,
          cidade: latest.cidade || "",
          lat: latest.lat!,
          lng: latest.lng!,
          ultimaAcao: latest.dtConclusao || "",
          totalAcoes: regs.length,
        });
      }
    }
    return points;
  }, [registroPoints]);

  const alta = regions.filter((r) => r.level === "Alta");
  const media = regions.filter((r) => r.level === "Média");
  const baixa = regions.filter((r) => r.level === "Baixa");

  const center: [number, number] = useMemo(() => {
    if (mapView === "clientes" && clientePoints.length > 0) {
      return [
        clientePoints.reduce((s, r) => s + r.lat, 0) / clientePoints.length,
        clientePoints.reduce((s, r) => s + r.lng, 0) / clientePoints.length,
      ] as [number, number];
    }
    if (regions.length > 0) {
      return [
        regions.reduce((s, r) => s + r.lat, 0) / regions.length,
        regions.reduce((s, r) => s + r.lng, 0) / regions.length,
      ] as [number, number];
    }
    return [-26.5, -52.0] as [number, number];
  }, [mapView, clientePoints, regions]);

  return { regions, registroPoints, clientePoints, alta, media, baixa, center };
}
