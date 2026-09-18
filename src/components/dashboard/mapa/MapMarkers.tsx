import { memo } from "react";
import { Marker, Popup, Tooltip as LTooltip } from "react-leaflet";
import {
  createPinIcon,
  formatCurrency,
  type ClientePoint,
  type MapRegion,
  type MapViewMode,
  type OportunidadePoint,
} from "./types";
import { OportunidadeMarkers } from "./OportunidadeMarkers";

/** Cor fixa dos pinos de cliente: constante de módulo para o cache de ícone acertar sempre. */
const COR_PIN_CLIENTE = "var(--voux-champagne-400)";

/** Fallback estável: `?? []` no JSX criava um array novo por render e furava o memo abaixo. */
const EMPTY_OPORTUNIDADES: OportunidadePoint[] = [];

interface MapMarkersProps {
  mapView: MapViewMode;
  clientePoints: ClientePoint[];
  regions: MapRegion[];
  onRegionClick: (r: MapRegion) => void;
  oportunidades?: OportunidadePoint[];
}

/**
 * Um cliente. Memoizado para segurar o array literal de `position` — ver a nota
 * em `OportunidadePin`. O `onRegionClick` não passa por aqui, então nenhum
 * handler recriado no pai invalida este memo.
 */
const ClienteMarker = memo(function ClienteMarker({ cliente }: { cliente: ClientePoint }) {
  return (
    <Marker position={[cliente.lat, cliente.lng]} icon={createPinIcon(COR_PIN_CLIENTE)}>
      <LTooltip direction="top" offset={[0, -42]}>
        <div className="text-xs"><strong>{cliente.cliente}</strong><br />{cliente.cidade} · {cliente.totalAcoes} ações</div>
      </LTooltip>
      <Popup>
        <div className="text-xs space-y-1 min-w-[180px]">
          <p className="font-bold text-sm">{cliente.cliente}</p>
          <p>Cidade: <strong>{cliente.cidade}</strong></p>
          <p>Total ações: <strong>{cliente.totalAcoes}</strong></p>
          <p>Última visita: <strong>{cliente.ultimaAcao || "—"}</strong></p>
        </div>
      </Popup>
    </Marker>
  );
});

/**
 * Uma região. O `eventHandlers` fica inline de propósito: o `react-leaflet`
 * troca os listeners quando o objeto muda, o que é barato, ao contrário do
 * `setIcon`. O que o memo evita aqui é o reposicionamento do pino.
 */
const RegiaoMarker = memo(function RegiaoMarker({
  regiao,
  onRegionClick,
}: {
  regiao: MapRegion;
  onRegionClick: (r: MapRegion) => void;
}) {
  return (
    <Marker
      position={[regiao.lat, regiao.lng]}
      icon={createPinIcon(regiao.color)}
      eventHandlers={{ click: () => onRegionClick(regiao) }}
    >
      <LTooltip direction="top" offset={[0, -42]}>
        <div className="text-xs"><strong>{regiao.cidade}</strong><br />{regiao.totalAcoes} ações · {regiao.clientes} clientes</div>
      </LTooltip>
      <Popup>
        <div className="text-xs space-y-1 min-w-[180px]">
          <p className="font-bold text-sm">{regiao.cidade}</p>
          <p>Ações: <strong>{regiao.totalAcoes}</strong></p>
          <p>Clientes: <strong>{regiao.clientes}</strong></p>
          <p>Pipeline: <strong>{formatCurrency(regiao.pipeline)}</strong></p>
          <p>Visitas: <strong>{regiao.visitas}</strong></p>
          <p>Nível: <span style={{ color: regiao.color, fontWeight: 700 }}>{regiao.level}</span></p>
        </div>
      </Popup>
    </Marker>
  );
});

/**
 * Camada de marcadores dos três modos do mapa. Extraída do `MapView` porque é a
 * parte que o `memo` precisa proteger: o `MapView` renderiza a moldura (botões,
 * header do fullscreen), esta camada renderiza os N pinos. Como o `MapView`
 * monta esta camada DUAS vezes quando o fullscreen está aberto (inline +
 * overlay), memoizar aqui vale por duas.
 */
export const MapMarkers = memo(function MapMarkers({
  mapView,
  clientePoints,
  regions,
  onRegionClick,
  oportunidades,
}: MapMarkersProps) {
  if (mapView === "oportunidades") {
    return <OportunidadeMarkers oportunidades={oportunidades ?? EMPTY_OPORTUNIDADES} />;
  }

  if (mapView === "clientes") {
    return (
      <>
        {clientePoints.map((c) => (
          <ClienteMarker key={c.cliente} cliente={c} />
        ))}
      </>
    );
  }

  return (
    <>
      {regions.map((r) => (
        <RegiaoMarker key={r.cidade} regiao={r} onRegionClick={onRegionClick} />
      ))}
    </>
  );
});
