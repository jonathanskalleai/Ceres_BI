import { useMemo, useState, useCallback } from "react";
import { DadosComerciais, Filters, RegiaoSummary, Registro } from "@/types/comercial";
import { MapPin, Eye, Users, Maximize2, Minimize2, X } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Tooltip as LTooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  data: DadosComerciais;
  filters: Filters;
}

interface MapRegion {
  cidade: string;
  lat: number;
  lng: number;
  totalAcoes: number;
  clientes: number;
  pipeline: number;
  visitas: number;
  color: string;
  level: string;
}

interface ClientePoint {
  cliente: string;
  cidade: string;
  lat: number;
  lng: number;
  ultimaAcao: string;
  totalAcoes: number;
}

type MapView = "clientes" | "regioes";

const CARD_BASE =
  "relative overflow-hidden rounded-[20px] p-[22px_24px] bg-gradient-to-b from-[var(--voux-card-from)] to-[var(--voux-card-to)] border border-[var(--voux-card-border)] shadow-[var(--voux-card-shadow)]";

const MONO: React.CSSProperties = {
  fontFamily: "var(--voux-font-mono, 'JetBrains Mono', monospace)",
};

const formatCurrency = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}K` : `R$ ${v.toFixed(0)}`;

const createPinIcon = (color: string): L.DivIcon =>
  L.divIcon({
    html: `<svg width="18" height="42" viewBox="0 0 18 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Ball head -->
      <circle cx="9" cy="9" r="8.5" fill="${color}"/>
      <!-- Glossy highlight -->
      <circle cx="6.5" cy="5.5" r="3" fill="rgba(255,255,255,0.38)"/>
      <circle cx="5.5" cy="4.5" r="1.2" fill="rgba(255,255,255,0.55)"/>
      <!-- Thin metallic stem -->
      <line x1="9" y1="17" x2="9" y2="42" stroke="rgba(180,170,160,0.85)" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    className: "",
    iconSize: [18, 42],
    iconAnchor: [9, 42],
    popupAnchor: [0, -42],
    tooltipAnchor: [0, -42],
  });

export const DashboardMapa = ({ data, filters }: Props) => {
  const [_selectedRegion, setSelectedRegion] = useState<MapRegion | null>(null);
  const [mapView, setMapView] = useState<MapView>("clientes");
  const [fullscreen, setFullscreen] = useState(false);
  const toggleFullscreen = useCallback(() => setFullscreen((v) => !v), []);

  const regions = useMemo(() => {
    let regioes = data.regioes.filter((r: RegiaoSummary) => {
      if (r.lat == null || r.lng == null) return false;
      if (r.lat === 0 && r.lng === 0) return false;
      if (r.lat < -34 || r.lat > 6 || r.lng < -75 || r.lng > -33) return false;
      return true;
    });
    if (filters.cidade) regioes = regioes.filter((r) => r.cidade === filters.cidade);

    const maxAcoes = Math.max(...regioes.map((r) => r.totalAcoes), 1);
    const p33 = maxAcoes * 0.33;
    const p66 = maxAcoes * 0.66;

    return regioes.map((r: RegiaoSummary) => {
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
  }, [data, filters]);

  const registroPoints = useMemo(() => {
    let regs = data.registrosRecentes.filter((r: Registro) => r.lat && r.lng);
    if (filters.dateRange?.from) regs = regs.filter((r) => r.dtConclusao && r.dtConclusao >= filters.dateRange!.from);
    if (filters.dateRange?.to) regs = regs.filter((r) => r.dtConclusao && r.dtConclusao <= filters.dateRange!.to);
    if (filters.cidade) regs = regs.filter((r) => r.cidade === filters.cidade);
    if (filters.tipoAcao) regs = regs.filter((r) => r.tipoAcao === filters.tipoAcao);
    return regs;
  }, [data, filters]);

  const clientePoints = useMemo<ClientePoint[]>(() => {
    const grouped = new Map<string, typeof registroPoints>();
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

      {/* KPIs */}
      {mapView === "clientes" ? (
        <div className="grid grid-cols-3 gap-4">
          <div className={CARD_BASE} style={{ borderLeft: "3px solid var(--voux-accent)" }}>
            <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--voux-text-faint)] mb-3" style={MONO}>
              CLIENTES MAPEADOS
            </p>
            <p className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[var(--voux-accent)]">
              {clientePoints.length}
            </p>
            <p className="text-[11px] text-[var(--voux-text-faint)] mt-2" style={MONO}>
              com coordenadas GPS
            </p>
          </div>

          <div className={CARD_BASE} style={{ borderLeft: "3px solid var(--voux-text-primary)" }}>
            <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--voux-text-faint)] mb-3" style={MONO}>
              TOTAL DE AÇÕES
            </p>
            <p className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[var(--voux-text-primary)]">
              {clientePoints.reduce((s, c) => s + c.totalAcoes, 0)}
            </p>
            <p className="text-[11px] text-[var(--voux-text-faint)] mt-2" style={MONO}>
              registros no período
            </p>
          </div>

          <div className={CARD_BASE} style={{ borderLeft: "3px solid #22c55e" }}>
            <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--voux-text-faint)] mb-3" style={MONO}>
              CIDADES COBERTAS
            </p>
            <p className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[#22c55e]">
              {new Set(clientePoints.map((c) => c.cidade)).size}
            </p>
            <p className="text-[11px] text-[var(--voux-text-faint)] mt-2" style={MONO}>
              municípios atendidos
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className={CARD_BASE} style={{ borderLeft: "3px solid #22c55e" }}>
            <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--voux-text-faint)] mb-3" style={MONO}>
              ALTA ATIVIDADE
            </p>
            <p className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[#22c55e]">
              {alta.length}
            </p>
            <p className="text-[11px] text-[var(--voux-text-faint)] mt-2" style={MONO}>
              regiões — verde no mapa
            </p>
          </div>

          <div className={CARD_BASE} style={{ borderLeft: "3px solid #eab308" }}>
            <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--voux-text-faint)] mb-3" style={MONO}>
              MÉDIA ATIVIDADE
            </p>
            <p className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[#eab308]">
              {media.length}
            </p>
            <p className="text-[11px] text-[var(--voux-text-faint)] mt-2" style={MONO}>
              regiões — amarelo no mapa
            </p>
          </div>

          <div className={CARD_BASE} style={{ borderLeft: "3px solid #ef4444" }}>
            <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--voux-text-faint)] mb-3" style={MONO}>
              BAIXA ATIVIDADE
            </p>
            <p className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[#ef4444]">
              {baixa.length}
            </p>
            <p className="text-[11px] text-[var(--voux-text-faint)] mt-2" style={MONO}>
              regiões — vermelho no mapa
            </p>
          </div>
        </div>
      )}

      {/* Map wrapper — inline */}
      <div className="relative overflow-hidden rounded-[20px] border border-[var(--voux-card-border)] shadow-[var(--voux-card-shadow)]" style={{ height: 520 }}>
        <MapContainer key={`inline-${mapView}`} center={center} zoom={7} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {mapView === "clientes" && clientePoints.map((c) => (
            <Marker key={c.cliente} position={[c.lat, c.lng]} icon={createPinIcon("#c8b99a")}>
              <LTooltip direction="top" offset={[0, -42]}>
                <div className="text-xs"><strong>{c.cliente}</strong><br />{c.cidade} · {c.totalAcoes} ações</div>
              </LTooltip>
              <Popup>
                <div className="text-xs space-y-1 min-w-[180px]">
                  <p className="font-bold text-sm">{c.cliente}</p>
                  <p>Cidade: <strong>{c.cidade}</strong></p>
                  <p>Total ações: <strong>{c.totalAcoes}</strong></p>
                  <p>Última visita: <strong>{c.ultimaAcao || "—"}</strong></p>
                </div>
              </Popup>
            </Marker>
          ))}
          {mapView === "regioes" && regions.map((r) => (
            <Marker key={r.cidade} position={[r.lat, r.lng]} icon={createPinIcon(r.color)} eventHandlers={{ click: () => setSelectedRegion(r) }}>
              <LTooltip direction="top" offset={[0, -42]}>
                <div className="text-xs"><strong>{r.cidade}</strong><br />{r.totalAcoes} ações · {r.clientes} clientes</div>
              </LTooltip>
              <Popup>
                <div className="text-xs space-y-1 min-w-[180px]">
                  <p className="font-bold text-sm">{r.cidade}</p>
                  <p>Ações: <strong>{r.totalAcoes}</strong></p>
                  <p>Clientes: <strong>{r.clientes}</strong></p>
                  <p>Pipeline: <strong>{formatCurrency(r.pipeline)}</strong></p>
                  <p>Visitas: <strong>{r.visitas}</strong></p>
                  <p>Nível: <span style={{ color: r.color, fontWeight: 700 }}>{r.level}</span></p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Fullscreen toggle button */}
        <button
          type="button"
          onClick={toggleFullscreen}
          title="Tela cheia"
          className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors"
          style={{
            background: "rgba(17,16,13,0.82)",
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
        <div
          className="fixed inset-0 z-[9999] flex flex-col"
          style={{ background: "var(--voux-card-to)" }}
        >
          {/* Overlay header */}
          <div
            className="flex items-center justify-between px-5 py-3 shrink-0"
            style={{ borderBottom: "1px solid var(--voux-card-border)" }}
          >
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-[var(--voux-accent)]" />
              <span className="text-[var(--voux-text-primary)] font-semibold text-sm">Mapa de Ações Comerciais</span>
              <span className="text-[var(--voux-text-faint)] text-[10px]" style={MONO}>
                {mapView === "clientes" ? `${clientePoints.length} clientes` : `${regions.length} regiões`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Tab switcher in fullscreen */}
              {(["clientes", "regioes"] as const).map((view) => {
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
            <MapContainer key={`fs-${mapView}`} center={center} zoom={7} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {mapView === "clientes" && clientePoints.map((c) => (
                <Marker key={c.cliente} position={[c.lat, c.lng]} icon={createPinIcon("#c8b99a")}>
                  <LTooltip direction="top" offset={[0, -42]}>
                    <div className="text-xs"><strong>{c.cliente}</strong><br />{c.cidade} · {c.totalAcoes} ações</div>
                  </LTooltip>
                  <Popup>
                    <div className="text-xs space-y-1 min-w-[180px]">
                      <p className="font-bold text-sm">{c.cliente}</p>
                      <p>Cidade: <strong>{c.cidade}</strong></p>
                      <p>Total ações: <strong>{c.totalAcoes}</strong></p>
                      <p>Última visita: <strong>{c.ultimaAcao || "—"}</strong></p>
                    </div>
                  </Popup>
                </Marker>
              ))}
              {mapView === "regioes" && regions.map((r) => (
                <Marker key={r.cidade} position={[r.lat, r.lng]} icon={createPinIcon(r.color)} eventHandlers={{ click: () => setSelectedRegion(r) }}>
                  <LTooltip direction="top" offset={[0, -42]}>
                    <div className="text-xs"><strong>{r.cidade}</strong><br />{r.totalAcoes} ações · {r.clientes} clientes</div>
                  </LTooltip>
                  <Popup>
                    <div className="text-xs space-y-1 min-w-[180px]">
                      <p className="font-bold text-sm">{r.cidade}</p>
                      <p>Ações: <strong>{r.totalAcoes}</strong></p>
                      <p>Clientes: <strong>{r.clientes}</strong></p>
                      <p>Pipeline: <strong>{formatCurrency(r.pipeline)}</strong></p>
                      <p>Visitas: <strong>{r.visitas}</strong></p>
                      <p>Nível: <span style={{ color: r.color, fontWeight: 700 }}>{r.level}</span></p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      )}

      {/* Details Table */}
      <div className={CARD_BASE}>
        <div className="flex items-center gap-2 mb-4">
          <Eye className="h-4 w-4 text-[var(--voux-accent)]" />
          <p
            className="text-[10px] tracking-[0.22em] uppercase text-[var(--voux-text-faint)]"
            style={MONO}
          >
            {mapView === "clientes" ? "CLIENTES MAPEADOS" : "DETALHAMENTO POR REGIÃO"}
          </p>
        </div>

        <div className="overflow-auto max-h-[400px]">
          {mapView === "clientes" ? (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--voux-card-border)" }}>
                  {["Cliente", "Cidade", "Ações", "Última Visita"].map((h, i) => (
                    <th
                      key={h}
                      className="py-2 text-[10px] tracking-[0.18em] uppercase text-[var(--voux-text-faint)] font-normal"
                      style={{ ...MONO, textAlign: i === 2 ? "center" : i === 3 ? "right" : "left" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...clientePoints]
                  .sort((a, b) => b.totalAcoes - a.totalAcoes)
                  .map((c) => (
                    <tr
                      key={c.cliente}
                      style={{ borderBottom: "1px solid var(--voux-card-border)" }}
                      className="hover:bg-[rgba(255,250,230,0.02)] transition-colors"
                    >
                      <td className="py-2 text-xs font-medium text-[var(--voux-text-primary)]">{c.cliente}</td>
                      <td className="py-2 text-xs text-[var(--voux-text-faint)]">{c.cidade}</td>
                      <td className="py-2 text-xs text-center font-semibold text-[var(--voux-accent)]" style={MONO}>
                        {c.totalAcoes}
                      </td>
                      <td className="py-2 text-xs text-right text-[var(--voux-text-faint)]" style={MONO}>
                        {c.ultimaAcao || "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--voux-card-border)" }}>
                  {["Cidade", "Nível", "Ações", "Clientes", "Visitas", "Pipeline"].map((h, i) => (
                    <th
                      key={h}
                      className="py-2 text-[10px] tracking-[0.18em] uppercase text-[var(--voux-text-faint)] font-normal"
                      style={{
                        ...MONO,
                        textAlign: i === 0 ? "left" : i === 5 ? "right" : "center",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...regions]
                  .sort((a, b) => b.totalAcoes - a.totalAcoes)
                  .map((r) => (
                    <tr
                      key={r.cidade}
                      style={{ borderBottom: "1px solid var(--voux-card-border)" }}
                      className="hover:bg-[rgba(255,250,230,0.02)] transition-colors"
                    >
                      <td className="py-2 text-xs font-medium text-[var(--voux-text-primary)]">{r.cidade}</td>
                      <td className="py-2 text-center">
                        <span
                          className="text-[9px] tracking-[0.14em] uppercase px-2 py-0.5 rounded-full"
                          style={{
                            ...MONO,
                            color: r.color,
                            border: `1px solid ${r.color}50`,
                            backgroundColor: `${r.color}14`,
                          }}
                        >
                          {r.level}
                        </span>
                      </td>
                      <td
                        className="py-2 text-xs text-center font-semibold text-[var(--voux-text-primary)]"
                        style={MONO}
                      >
                        {r.totalAcoes}
                      </td>
                      <td className="py-2 text-xs text-center text-[var(--voux-text-faint)]" style={MONO}>
                        {r.clientes}
                      </td>
                      <td className="py-2 text-xs text-center text-[var(--voux-text-faint)]" style={MONO}>
                        {r.visitas}
                      </td>
                      <td
                        className="py-2 text-xs text-right font-semibold text-[var(--voux-accent)]"
                        style={MONO}
                      >
                        {formatCurrency(r.pipeline)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
