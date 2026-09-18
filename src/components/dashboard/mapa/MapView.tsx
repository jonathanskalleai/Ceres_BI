import { memo, type ReactNode } from "react";
import { MapPin, Users, Maximize2, X } from "lucide-react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MONO, type MapRegion, type ClientePoint, type MapViewMode, type OportunidadePoint } from "./types";
import { MapMarkers } from "./MapMarkers";

interface MapViewProps {
  mapView: MapViewMode;
  setMapView: (v: MapViewMode) => void;
  clientePoints: ClientePoint[];
  regions: MapRegion[];
  center: [number, number];
  fullscreen: boolean;
  toggleFullscreen: () => void;
  onRegionClick: (r: MapRegion) => void;
  /**
   * Pinos do modo `oportunidades` (/bi/acoes). Opcional: `DashboardMapa` nao
   * passa e continua funcionando exatamente como antes.
   */
  oportunidades?: OportunidadePoint[];
  /**
   * Renderizacao vetorial em canvas. Necessario no modo `oportunidades`
   * (~2.240 CircleMarkers); sem efeito nos modos com divIcon, que sao DOM.
   */
  preferCanvas?: boolean;
  /** Esconde o seletor clientes|regioes quando o mapa tem um modo unico. */
  hideModeSwitch?: boolean;
  zoom?: number;
  /** Marcadores adicionais renderizados DENTRO do MapContainer (ex: clusters). */
  children?: ReactNode;
  /** Resumo real quando há agrupamento de oportunidades no mesmo local. */
  oportunidadesResumo?: { negocios: number; locais: number };
}

/**
 * Memoizado para cortar a cascata de re-render que vinha do pai (a seção do BI
 * remede altura por ResizeObserver e libera as consultas em ondas). O memo só
 * paga se o pai estabilizar as props — incluindo `children`, que muda de
 * identidade a cada render de quem o cria. `AcoesMapaCanvas` faz isso.
 */
export const MapView = memo(({
  mapView,
  setMapView,
  clientePoints,
  regions,
  center,
  fullscreen,
  toggleFullscreen,
  onRegionClick,
  oportunidades,
  preferCanvas = false,
  hideModeSwitch = false,
  zoom = 7,
  children,
  oportunidadesResumo,
}: MapViewProps) => {
  return (
    <>
      {/* Inline map */}
      <div
        className="relative overflow-hidden rounded-[20px] border border-[var(--voux-card-border)] shadow-[var(--voux-card-shadow)]"
        style={{ height: 520 }}
      >
        <MapContainer key={`inline-${mapView}`} center={center} zoom={zoom} preferCanvas={preferCanvas} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapMarkers mapView={mapView} clientePoints={clientePoints} regions={regions} onRegionClick={onRegionClick} oportunidades={oportunidades} />
          {children}
        </MapContainer>

        <button
          type="button"
          onClick={toggleFullscreen}
          title="Tela cheia"
          className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors"
          style={{
            background: "var(--surface-raised, rgba(17,16,13,0.82))",
            border: "1px solid var(--voux-border-hover)",
            color: "var(--voux-accent)",
            backdropFilter: "blur(6px)",
            ...MONO,
            fontSize: 10,
            letterSpacing: "0.14em",
          }}
        >
          <Maximize2 className="h-3 w-3" />
          TELA CHEIA
        </button>
      </div>

      {/* Fullscreen overlay */}
      {fullscreen && (
        <FullscreenOverlay
          mapView={mapView}
          setMapView={setMapView}
          clientePoints={clientePoints}
          regions={regions}
          center={center}
          toggleFullscreen={toggleFullscreen}
          onRegionClick={onRegionClick}
          oportunidades={oportunidades}
          preferCanvas={preferCanvas}
          hideModeSwitch={hideModeSwitch}
          zoom={zoom}
          children={children}
          oportunidadesResumo={oportunidadesResumo}
        />
      )}
    </>
  );
});
MapView.displayName = "MapView";

function FullscreenOverlay({
  mapView,
  setMapView,
  clientePoints,
  regions,
  center,
  toggleFullscreen,
  onRegionClick,
  oportunidades,
  preferCanvas = false,
  hideModeSwitch = false,
  zoom = 7,
  children,
  oportunidadesResumo,
}: Omit<MapViewProps, "fullscreen">) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: "var(--voux-card-to)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--voux-card-border)" }}>
        <div className="flex items-center gap-3">
          <MapPin className="h-4 w-4 text-[var(--voux-accent)]" />
          <span className="text-[var(--voux-text-primary)] font-semibold text-sm">Mapa de Ações Comerciais</span>
          <span className="text-[var(--voux-text-faint)] text-[10px]" style={MONO}>
            {mapView === "oportunidades"
              ? oportunidadesResumo
                ? `${oportunidadesResumo.negocios} oportunidades em ${oportunidadesResumo.locais} locais`
                : `${(oportunidades ?? []).length} oportunidades`
              : mapView === "clientes"
                ? `${clientePoints.length} clientes`
                : `${regions.length} regiões`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!hideModeSwitch && (["clientes", "regioes"] as const).map((view) => {
            const active = mapView === view;
            const Icon = view === "clientes" ? Users : MapPin;
            return (
              <button
                key={view}
                type="button"
                onClick={() => setMapView(view)}
                className="flex items-center gap-1.5 text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full transition-colors"
                style={{
                  ...MONO,
                  backgroundColor: active ? "var(--voux-accent)" : "transparent",
                  color: active ? "var(--voux-card-to)" : "var(--voux-text-faint)",
                  border: active ? "1px solid var(--voux-accent)" : "1px solid var(--voux-border-hover)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                <Icon className="h-3 w-3" />
                {view === "clientes" ? "Clientes" : "Regiões"}
              </button>
            );
          })}
          <button
            type="button"
            onClick={toggleFullscreen}
            title="Fechar tela cheia"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full ml-2 transition-colors"
            style={{
              ...MONO,
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.3)",
              color: "var(--voux-danger)",
              fontSize: 10,
              letterSpacing: "0.14em",
            }}
          >
            <X className="h-3 w-3" />
            FECHAR
          </button>
        </div>
      </div>

      {/* Full-height map */}
      <div className="flex-1 relative">
        <MapContainer key={`fs-${mapView}`} center={center} zoom={zoom} preferCanvas={preferCanvas} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapMarkers mapView={mapView} clientePoints={clientePoints} regions={regions} onRegionClick={onRegionClick} oportunidades={oportunidades} />
          {children}
        </MapContainer>
      </div>
    </div>
  );
}

export default MapView;
