import { MapView } from "@/components/dashboard/mapa";
import { ClusterMarker } from "@/components/dashboard/mapa/ClusterMarker";
import { OPORTUNIDADE_ABERTA_PIN_COLOR, type OportunidadePoint } from "@/components/dashboard/mapa";
import { fmtBRL, fmtNum } from "@/lib/formatters";

/** Centro padrao do mapa — mesma regiao de atuacao do restante do dashboard. */
const CENTRO: [number, number] = [-27.1, -52.6];

interface ClusterGroup {
  key: string;
  lat: number;
  lng: number;
  points: OportunidadePoint[];
}

interface Props {
  singlePoints: OportunidadePoint[];
  clusterGroups: ClusterGroup[];
  comCoordenada: number;
  total: number;
  valorNoMapa: number;
  valorTotal: number;
  semCoordenada: number;
  viaAcao: number;
  viaCarteira: number;
  locaisNoMapa: number;
  oportunidadesAgrupadas: number;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}

export default function AcoesMapaCanvas({
  singlePoints,
  clusterGroups,
  comCoordenada,
  total,
  valorNoMapa,
  valorTotal,
  semCoordenada,
  viaAcao,
  viaCarteira,
  locaisNoMapa,
  oportunidadesAgrupadas,
  fullscreen,
  onToggleFullscreen,
}: Props) {
  return (
    <>
      <MapView
        mapView="oportunidades"
        setMapView={() => {}}
        clientePoints={[]}
        regions={[]}
        oportunidades={singlePoints}
        center={CENTRO}
        zoom={7}
        hideModeSwitch
        fullscreen={fullscreen}
        toggleFullscreen={onToggleFullscreen}
        onRegionClick={() => {}}
        oportunidadesResumo={{ negocios: comCoordenada, locais: locaisNoMapa }}
      >
        {clusterGroups.map((group) => (
          <ClusterMarker key={group.key} points={group.points} lat={group.lat} lng={group.lng} />
        ))}
      </MapView>
      <p className="mt-3 text-[11px] leading-relaxed text-[var(--voux-text-muted)]">
        {fmtNum(comCoordenada)} de {fmtNum(total)} oportunidades do período estão plotadas em {fmtNum(locaisNoMapa)} pinos (
        {fmtBRL(valorNoMapa)} de {fmtBRL(valorTotal)}).{" "}
        {oportunidadesAgrupadas > 0 && (
          <>
            {fmtNum(oportunidadesAgrupadas)} oportunidade{oportunidadesAgrupadas === 1 ? "" : "s"} compartilha
            localização com outra e aparece em um pino com contador. {" "}
          </>
        )}
        {semCoordenada > 0 && (
          <strong className="text-[var(--voux-text-primary)]">
            {fmtNum(semCoordenada)} nao aparecem no mapa por falta de coordenada do cliente.
          </strong>
        )}{" "}
        Coordenada resolvida pela ultima acao geolocalizada do cliente ({fmtNum(viaAcao)}) e, na falta dela,
        pelo cadastro da carteira ({fmtNum(viaCarteira)}). A oportunidade entra pela primeira passagem no funil
        VENDAS; ganho = pedido aprovado e perdido = fechamento no período. Pino azul = em andamento, verde =
        ganho e vermelho = perdido.
      </p>
    </>
  );
}
