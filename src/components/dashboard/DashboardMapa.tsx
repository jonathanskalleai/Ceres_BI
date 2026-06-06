import { useMemo, useState } from "react";
import { DadosComerciais, Filters } from "@/types/comercial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Eye, Users } from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip as LTooltip } from "react-leaflet";
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

const formatCurrency = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}K` : `R$ ${v.toFixed(0)}`;

export const DashboardMapa = ({ data, filters }: Props) => {
  const [_selectedRegion, setSelectedRegion] = useState<MapRegion | null>(null);
  const [mapView, setMapView] = useState<MapView>("clientes");

  const regions = useMemo(() => {
    let regioes = data.regioes.filter((r: any) => {
      if (r.lat == null || r.lng == null) return false;
      if (r.lat === 0 && r.lng === 0) return false;
      // Brazil bounds check: lat -34 to 5, lng -74 to -34
      if (r.lat < -34 || r.lat > 6 || r.lng < -75 || r.lng > -33) return false;
      return true;
    });
    if (filters.cidade) regioes = regioes.filter((r) => r.cidade === filters.cidade);

    const maxAcoes = Math.max(...regioes.map((r) => r.totalAcoes), 1);
    const p33 = maxAcoes * 0.33;
    const p66 = maxAcoes * 0.66;

    return regioes.map((r: any) => {
      let color: string;
      let level: string;
      if (r.totalAcoes >= p66) {
        color = "#22c55e"; level = "Alta";
      } else if (r.totalAcoes >= p33) {
        color = "#eab308"; level = "Média";
      } else {
        color = "#ef4444"; level = "Baixa";
      }
      return { cidade: r.cidade, lat: r.lat, lng: r.lng, totalAcoes: r.totalAcoes, clientes: r.clientes, pipeline: r.pipeline, visitas: r.visitas, color, level } as MapRegion;
    });
  }, [data, filters]);

  // Registros with coords for individual points
  const registroPoints = useMemo(() => {
    let regs = data.registrosRecentes.filter((r: any) => r.lat && r.lng);
    if (filters.vendedor) regs = regs.filter((r) => r.vendedor === filters.vendedor);
    if (filters.cidade) regs = regs.filter((r) => r.cidade === filters.cidade);
    if (filters.tipoAcao) regs = regs.filter((r) => r.tipoAcao === filters.tipoAcao);
    if (filters.ano) regs = regs.filter((r) => r.dtConclusao?.includes(filters.ano));
    if (filters.mes) regs = regs.filter((r) => {
      const parts = r.dtConclusao?.split(/[-/]/);
      return parts && parts.length >= 2 && parts[1] === filters.mes;
    });
    return regs;
  }, [data, filters]);

  // Group registroPoints by client, pick the most recent action with GPS
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Mapa de Ações Comerciais
          </h2>
          <p className="text-sm text-muted-foreground">
            {mapView === "clientes"
              ? `${clientePoints.length} clientes mapeados`
              : `${regions.length} regiões, ${registroPoints.length} registros`}
          </p>
        </div>
        <Tabs value={mapView} onValueChange={(v) => setMapView(v as MapView)}>
          <TabsList>
            <TabsTrigger value="clientes">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Clientes
            </TabsTrigger>
            <TabsTrigger value="regioes">
              <MapPin className="h-3.5 w-3.5 mr-1.5" />
              Regiões
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPIs */}
      {mapView === "clientes" ? (
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm border-l-4 border-l-primary">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-primary">{clientePoints.length}</p>
              <p className="text-xs text-muted-foreground">Clientes Mapeados</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-blue-500">
                {clientePoints.reduce((s, c) => s + c.totalAcoes, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Total de Ações</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-emerald-500">
                {new Set(clientePoints.map((c) => c.cidade)).size}
              </p>
              <p className="text-xs text-muted-foreground">Cidades Cobertas</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm border-l-4" style={{ borderLeftColor: "#22c55e" }}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-success">{alta.length}</p>
              <p className="text-xs text-muted-foreground">Regiões Alta Atividade</p>
              <div className="flex items-center gap-1 mt-1">
                <div className="w-3 h-3 rounded-full bg-success" />
                <span className="text-[10px] text-muted-foreground">Verde no mapa</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm border-l-4" style={{ borderLeftColor: "#eab308" }}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-warning">{media.length}</p>
              <p className="text-xs text-muted-foreground">Regiões Média Atividade</p>
              <div className="flex items-center gap-1 mt-1">
                <div className="w-3 h-3 rounded-full bg-warning" />
                <span className="text-[10px] text-muted-foreground">Amarelo no mapa</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm border-l-4" style={{ borderLeftColor: "#ef4444" }}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-destructive">{baixa.length}</p>
              <p className="text-xs text-muted-foreground">Regiões Baixa Atividade</p>
              <div className="flex items-center gap-1 mt-1">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <span className="text-[10px] text-muted-foreground">Vermelho no mapa</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Map */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div style={{ height: 520 }}>
            <MapContainer center={center} zoom={7} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {mapView === "clientes" && clientePoints.map((c) => (
                <CircleMarker
                  key={c.cliente}
                  center={[c.lat, c.lng]}
                  radius={6}
                  pathOptions={{
                    fillColor: "#D4A574",
                    color: "#D4A574",
                    weight: 2,
                    fillOpacity: 0.75,
                  }}
                >
                  <LTooltip direction="top" offset={[0, -5]}>
                    <div className="text-xs">
                      <strong>{c.cliente}</strong><br />
                      {c.cidade} · {c.totalAcoes} ações
                    </div>
                  </LTooltip>
                  <Popup>
                    <div className="text-xs space-y-1 min-w-[180px]">
                      <p className="font-bold text-sm">{c.cliente}</p>
                      <p>Cidade: <strong>{c.cidade}</strong></p>
                      <p>Total ações: <strong>{c.totalAcoes}</strong></p>
                      <p>Última visita: <strong>{c.ultimaAcao || "—"}</strong></p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
              {mapView === "regioes" && regions.map((r) => (
                <CircleMarker
                  key={r.cidade}
                  center={[r.lat, r.lng]}
                  radius={Math.max(6, Math.min(25, Math.sqrt(r.totalAcoes) * 1.5))}
                  pathOptions={{
                    fillColor: r.color,
                    color: r.color,
                    weight: 2,
                    fillOpacity: 0.6,
                  }}
                  eventHandlers={{ click: () => setSelectedRegion(r) }}
                >
                  <LTooltip direction="top" offset={[0, -5]}>
                    <div className="text-xs">
                      <strong>{r.cidade}</strong><br />
                      {r.totalAcoes} ações · {r.clientes} clientes
                    </div>
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
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      {/* Details Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Eye className="h-4 w-4" />
            {mapView === "clientes" ? "Clientes Mapeados" : "Detalhamento por Região"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-[400px]">
            {mapView === "clientes" ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-xs font-semibold text-muted-foreground">Cliente</th>
                    <th className="text-left py-2 text-xs font-semibold text-muted-foreground">Cidade</th>
                    <th className="text-center py-2 text-xs font-semibold text-muted-foreground">Ações</th>
                    <th className="text-right py-2 text-xs font-semibold text-muted-foreground">Última Visita</th>
                  </tr>
                </thead>
                <tbody>
                  {[...clientePoints].sort((a, b) => b.totalAcoes - a.totalAcoes).map((c) => (
                    <tr key={c.cliente} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="py-2 text-xs font-medium">{c.cliente}</td>
                      <td className="py-2 text-xs text-muted-foreground">{c.cidade}</td>
                      <td className="py-2 text-xs text-center font-semibold">{c.totalAcoes}</td>
                      <td className="py-2 text-xs text-right">{c.ultimaAcao || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-xs font-semibold text-muted-foreground">Cidade</th>
                    <th className="text-center py-2 text-xs font-semibold text-muted-foreground">Nível</th>
                    <th className="text-center py-2 text-xs font-semibold text-muted-foreground">Ações</th>
                    <th className="text-center py-2 text-xs font-semibold text-muted-foreground">Clientes</th>
                    <th className="text-center py-2 text-xs font-semibold text-muted-foreground">Visitas</th>
                    <th className="text-right py-2 text-xs font-semibold text-muted-foreground">Pipeline</th>
                  </tr>
                </thead>
                <tbody>
                  {[...regions].sort((a, b) => b.totalAcoes - a.totalAcoes).map((r) => (
                    <tr key={r.cidade} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="py-2 text-xs font-medium">{r.cidade}</td>
                      <td className="py-2 text-center">
                        <Badge className="text-[10px]" style={{ backgroundColor: r.color + "20", color: r.color, border: `1px solid ${r.color}40` }}>
                          {r.level}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs text-center font-semibold">{r.totalAcoes}</td>
                      <td className="py-2 text-xs text-center">{r.clientes}</td>
                      <td className="py-2 text-xs text-center">{r.visitas}</td>
                      <td className="py-2 text-xs text-right font-semibold">{formatCurrency(r.pipeline)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
