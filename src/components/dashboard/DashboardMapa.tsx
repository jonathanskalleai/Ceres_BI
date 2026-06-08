import { useMemo, useState } from "react";
import { DadosComerciais, Filters, RegiaoSummary, Registro } from "@/types/comercial";
import { MapPin, Eye, Users } from "lucide-react";
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
  "relative overflow-hidden rounded-[20px] p-[22px_24px] bg-gradient-to-b from-[#18160f] to-[#11100d] border border-[rgba(214,207,193,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,250,230,0.03)]";

const MONO: React.CSSProperties = {
  fontFamily: "var(--voux-font-mono, 'JetBrains Mono', monospace)",
};

const formatCurrency = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}K` : `R$ ${v.toFixed(0)}`;

const createPinIcon = (color: string): L.DivIcon =>
  L.divIcon({
    html: `<svg width="22" height="30" viewBox="0 0 22 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11 0C4.925 0 0 4.925 0 11C0 19.25 11 30 11 30C11 30 22 19.25 22 11C22 4.925 17.075 0 11 0Z" fill="${color}" fill-opacity="0.88"/>
      <circle cx="11" cy="11" r="4.5" fill="rgba(255,255,255,0.9)"/>
    </svg>`,
    className: "",
    iconSize: [22, 30],
    iconAnchor: [11, 30],
    popupAnchor: [0, -30],
    tooltipAnchor: [0, -30],
  });

export const DashboardMapa = ({ data, filters }: Props) => {
  const [_selectedRegion, setSelectedRegion] = useState<MapRegion | null>(null);
  const [mapView, setMapView] = useState<MapView>("clientes");

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
    if (filters.vendedor) regs = regs.filter((r) => r.vendedor === filters.vendedor);
    if (filters.cidade) regs = regs.filter((r) => r.cidade === filters.cidade);
    if (filters.tipoAcao) regs = regs.filter((r) => r.tipoAcao === filters.tipoAcao);
    if (filters.ano) regs = regs.filter((r) => r.dtConclusao?.includes(filters.ano));
    if (filters.mes)
      regs = regs.filter((r) => {
        const parts = r.dtConclusao?.split(/[-/]/);
        return parts && parts.length >= 2 && parts[1] === filters.mes;
      });
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p
            className="text-[10px] tracking-[0.22em] uppercase text-[#8a8273] mb-1"
            style={MONO}
          >
            — MAPA COMERCIAL
          </p>
          <h2 className="text-2xl font-bold text-[#ece5d4] flex items-center gap-2">
            <MapPin className="h-5 w-5 text-[#c8b99a]" />
            Mapa de Ações Comerciais
          </h2>
          <p className="text-[11px] text-[#8a8273] mt-1" style={MONO}>
            {mapView === "clientes"
              ? `${clientePoints.length} clientes mapeados`
              : `${regions.length} regiões, ${registroPoints.length} registros`}
          </p>
        </div>

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
                  backgroundColor: active ? "#c8b99a" : "transparent",
                  color: active ? "#11100d" : "#8a8273",
                  border: active ? "1px solid #c8b99a" : "1px solid rgba(138,130,115,0.35)",
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
          <div className={CARD_BASE} style={{ borderLeft: "3px solid #c8b99a" }}>
            <p className="text-[10px] tracking-[0.22em] uppercase text-[#8a8273] mb-3" style={MONO}>
              CLIENTES MAPEADOS
            </p>
            <p className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[#c8b99a]">
              {clientePoints.length}
            </p>
            <p className="text-[11px] text-[#8a8273] mt-2" style={MONO}>
              com coordenadas GPS
            </p>
          </div>

          <div className={CARD_BASE} style={{ borderLeft: "3px solid #ece5d4" }}>
            <p className="text-[10px] tracking-[0.22em] uppercase text-[#8a8273] mb-3" style={MONO}>
              TOTAL DE AÇÕES
            </p>
            <p className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[#ece5d4]">
              {clientePoints.reduce((s, c) => s + c.totalAcoes, 0)}
            </p>
            <p className="text-[11px] text-[#8a8273] mt-2" style={MONO}>
              registros no período
            </p>
          </div>

          <div className={CARD_BASE} style={{ borderLeft: "3px solid #22c55e" }}>
            <p className="text-[10px] tracking-[0.22em] uppercase text-[#8a8273] mb-3" style={MONO}>
              CIDADES COBERTAS
            </p>
            <p className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[#22c55e]">
              {new Set(clientePoints.map((c) => c.cidade)).size}
            </p>
            <p className="text-[11px] text-[#8a8273] mt-2" style={MONO}>
              municípios atendidos
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className={CARD_BASE} style={{ borderLeft: "3px solid #22c55e" }}>
            <p className="text-[10px] tracking-[0.22em] uppercase text-[#8a8273] mb-3" style={MONO}>
              ALTA ATIVIDADE
            </p>
            <p className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[#22c55e]">
              {alta.length}
            </p>
            <p className="text-[11px] text-[#8a8273] mt-2" style={MONO}>
              regiões — verde no mapa
            </p>
          </div>

          <div className={CARD_BASE} style={{ borderLeft: "3px solid #eab308" }}>
            <p className="text-[10px] tracking-[0.22em] uppercase text-[#8a8273] mb-3" style={MONO}>
              MÉDIA ATIVIDADE
            </p>
            <p className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[#eab308]">
              {media.length}
            </p>
            <p className="text-[11px] text-[#8a8273] mt-2" style={MONO}>
              regiões — amarelo no mapa
            </p>
          </div>

          <div className={CARD_BASE} style={{ borderLeft: "3px solid #ef4444" }}>
            <p className="text-[10px] tracking-[0.22em] uppercase text-[#8a8273] mb-3" style={MONO}>
              BAIXA ATIVIDADE
            </p>
            <p className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[#ef4444]">
              {baixa.length}
            </p>
            <p className="text-[11px] text-[#8a8273] mt-2" style={MONO}>
              regiões — vermelho no mapa
            </p>
          </div>
        </div>
      )}

      {/* Map */}
      <div
        className="overflow-hidden rounded-[20px] border border-[rgba(214,207,193,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
        style={{ height: 520 }}
      >
        <MapContainer center={center} zoom={7} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {mapView === "clientes" &&
            clientePoints.map((c) => (
              <Marker
                key={c.cliente}
                position={[c.lat, c.lng]}
                icon={createPinIcon("#c8b99a")}
              >
                <LTooltip direction="top" offset={[0, -30]}>
                  <div className="text-xs">
                    <strong>{c.cliente}</strong>
                    <br />
                    {c.cidade} · {c.totalAcoes} ações
                  </div>
                </LTooltip>
                <Popup>
                  <div className="text-xs space-y-1 min-w-[180px]">
                    <p className="font-bold text-sm">{c.cliente}</p>
                    <p>
                      Cidade: <strong>{c.cidade}</strong>
                    </p>
                    <p>
                      Total ações: <strong>{c.totalAcoes}</strong>
                    </p>
                    <p>
                      Última visita: <strong>{c.ultimaAcao || "—"}</strong>
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          {mapView === "regioes" &&
            regions.map((r) => (
              <Marker
                key={r.cidade}
                position={[r.lat, r.lng]}
                icon={createPinIcon(r.color)}
                eventHandlers={{ click: () => setSelectedRegion(r) }}
              >
                <LTooltip direction="top" offset={[0, -30]}>
                  <div className="text-xs">
                    <strong>{r.cidade}</strong>
                    <br />
                    {r.totalAcoes} ações · {r.clientes} clientes
                  </div>
                </LTooltip>
                <Popup>
                  <div className="text-xs space-y-1 min-w-[180px]">
                    <p className="font-bold text-sm">{r.cidade}</p>
                    <p>
                      Ações: <strong>{r.totalAcoes}</strong>
                    </p>
                    <p>
                      Clientes: <strong>{r.clientes}</strong>
                    </p>
                    <p>
                      Pipeline: <strong>{formatCurrency(r.pipeline)}</strong>
                    </p>
                    <p>
                      Visitas: <strong>{r.visitas}</strong>
                    </p>
                    <p>
                      Nível:{" "}
                      <span style={{ color: r.color, fontWeight: 700 }}>{r.level}</span>
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>

      {/* Details Table */}
      <div className={CARD_BASE}>
        <div className="flex items-center gap-2 mb-4">
          <Eye className="h-4 w-4 text-[#c8b99a]" />
          <p
            className="text-[10px] tracking-[0.22em] uppercase text-[#8a8273]"
            style={MONO}
          >
            {mapView === "clientes" ? "CLIENTES MAPEADOS" : "DETALHAMENTO POR REGIÃO"}
          </p>
        </div>

        <div className="overflow-auto max-h-[400px]">
          {mapView === "clientes" ? (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(214,207,193,0.08)" }}>
                  {["Cliente", "Cidade", "Ações", "Última Visita"].map((h, i) => (
                    <th
                      key={h}
                      className="py-2 text-[10px] tracking-[0.18em] uppercase text-[#8a8273] font-normal"
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
                      style={{ borderBottom: "1px solid rgba(214,207,193,0.05)" }}
                      className="hover:bg-[rgba(255,250,230,0.02)] transition-colors"
                    >
                      <td className="py-2 text-xs font-medium text-[#ece5d4]">{c.cliente}</td>
                      <td className="py-2 text-xs text-[#8a8273]">{c.cidade}</td>
                      <td className="py-2 text-xs text-center font-semibold text-[#c8b99a]" style={MONO}>
                        {c.totalAcoes}
                      </td>
                      <td className="py-2 text-xs text-right text-[#8a8273]" style={MONO}>
                        {c.ultimaAcao || "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(214,207,193,0.08)" }}>
                  {["Cidade", "Nível", "Ações", "Clientes", "Visitas", "Pipeline"].map((h, i) => (
                    <th
                      key={h}
                      className="py-2 text-[10px] tracking-[0.18em] uppercase text-[#8a8273] font-normal"
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
                      style={{ borderBottom: "1px solid rgba(214,207,193,0.05)" }}
                      className="hover:bg-[rgba(255,250,230,0.02)] transition-colors"
                    >
                      <td className="py-2 text-xs font-medium text-[#ece5d4]">{r.cidade}</td>
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
                        className="py-2 text-xs text-center font-semibold text-[#ece5d4]"
                        style={MONO}
                      >
                        {r.totalAcoes}
                      </td>
                      <td className="py-2 text-xs text-center text-[#8a8273]" style={MONO}>
                        {r.clientes}
                      </td>
                      <td className="py-2 text-xs text-center text-[#8a8273]" style={MONO}>
                        {r.visitas}
                      </td>
                      <td
                        className="py-2 text-xs text-right font-semibold text-[#c8b99a]"
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
