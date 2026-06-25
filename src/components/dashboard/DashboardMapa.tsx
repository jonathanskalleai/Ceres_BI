import { useState, useCallback } from "react";
import type { RegiaoSummary, Registro, Filters } from "@/types/comercial";
import { MapPin, Users } from "lucide-react";
import { MapKpis, MapView, MapDetailsTable, useMapData } from "./mapa";
import { MapViewMode, MapRegion, MONO } from "./mapa/types";

interface DashboardMapaProps {
  regioes: RegiaoSummary[];
  registros: Registro[];
  filters: Filters;
}

export const DashboardMapa = ({ regioes, registros, filters }: DashboardMapaProps) => {
  const [_selectedRegion, setSelectedRegion] = useState<MapRegion | null>(null);
  const [mapView, setMapView] = useState<MapViewMode>("clientes");
  const [fullscreen, setFullscreen] = useState(false);
  const toggleFullscreen = useCallback(() => setFullscreen((v) => !v), []);

  const { regions, registroPoints, clientePoints, alta, media, baixa, center } =
    useMapData(regioes, registros, filters, mapView);

  return (
    <div className="p-6 space-y-6">
      {/* View switcher + subtitle */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-[var(--voux-text-faint)]" style={MONO}>
          {mapView === "clientes"
            ? `${clientePoints.length} clientes mapeados`
            : `${regions.length} regiões, ${registroPoints.length} registros`}
        </p>

        {/* Tab switcher */}
        <div className="flex gap-2">
          {(["clientes", "regioes"] as const).map((view) => {
            const active = mapView === view;
            const Icon = view === "clientes" ? Users : MapPin;
            const label = view === "clientes" ? "Clientes" : "Regiões";
            return (
              <button
                key={view}
                type="button"
                onClick={() => setMapView(view)}
                className="flex items-center gap-1.5 text-[10px] tracking-[0.18em] uppercase px-3.5 py-2 rounded-full transition-colors"
                style={{
                  ...MONO,
                  backgroundColor: active ? "var(--voux-accent)" : "transparent",
                  color: active ? "var(--voux-card-to)" : "var(--voux-text-faint)",
                  border: active ? "1px solid var(--voux-accent)" : "1px solid var(--voux-border-hover)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI cards */}
      <MapKpis
        mapView={mapView}
        clientePoints={clientePoints}
        alta={alta}
        media={media}
        baixa={baixa}
      />

      {/* Map (inline + fullscreen) */}
      <MapView
        mapView={mapView}
        setMapView={setMapView}
        clientePoints={clientePoints}
        regions={regions}
        center={center}
        fullscreen={fullscreen}
        toggleFullscreen={toggleFullscreen}
        onRegionClick={setSelectedRegion}
      />

      {/* Details table */}
      <MapDetailsTable
        mapView={mapView}
        clientePoints={clientePoints}
        regions={regions}
      />
    </div>
  );
};
