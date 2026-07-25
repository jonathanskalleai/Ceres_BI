import { CircleMarker, Popup, Tooltip as LTooltip } from "react-leaflet";
import { formatCurrency, type OportunidadePoint } from "./types";

/** Dias sem acao a partir dos quais o pino vira alerta visual. */
const PARADO_ALERTA_DIAS = 90;

/** Raio por faixa de valor — o negocio grande precisa saltar no mapa. */
function raio(valor: number | null): number {
  if (valor == null || valor <= 0) return 4;
  if (valor >= 500_000) return 9;
  if (valor >= 100_000) return 7;
  return 5;
}

function cor(diasParado: number | null): string {
  return diasParado != null && diasParado >= PARADO_ALERTA_DIAS
    ? "var(--voux-danger)"
    : "var(--voux-champagne-400)";
}

function labelDias(diasParado: number | null): string {
  return diasParado == null ? "sem acao registrada" : `${diasParado.toLocaleString("pt-BR")} dias parado`;
}

/**
 * Pinos das oportunidades abertas.
 *
 * `CircleMarker` (vetor, renderizado no canvas do Leaflet) em vez de
 * `divIcon`/`createPinIcon`: sao ~2.240 negocios abertos, e 2.240 nos de DOM
 * com SVG inline travam pan e zoom no mapa. O `preferCanvas` do MapContainer
 * so vale para camadas vetoriais — divIcon continuaria sendo DOM.
 */
export function OportunidadeMarkers({ oportunidades }: { oportunidades: OportunidadePoint[] }) {
  return (
    <>
      {oportunidades.map((o) => (
        <CircleMarker
          key={o.negocio}
          center={[o.lat, o.lng]}
          radius={raio(o.valor)}
          pathOptions={{
            color: cor(o.diasParado),
            fillColor: cor(o.diasParado),
            fillOpacity: 0.55,
            weight: 1.2,
          }}
        >
          <LTooltip direction="top">
            <div className="text-xs">
              <strong>{o.cliente ?? "Cliente nao identificado"}</strong>
              <br />
              {o.valor != null ? formatCurrency(o.valor) : "sem valor"} · {labelDias(o.diasParado)}
            </div>
          </LTooltip>
          <Popup>
            <div className="min-w-[200px] space-y-1 text-xs">
              <p className="text-sm font-bold">{o.cliente ?? "Cliente nao identificado"}</p>
              <p>Negocio: <strong>{o.negocio}</strong></p>
              <p>Valor: <strong>{o.valor != null ? formatCurrency(o.valor) : "—"}</strong></p>
              <p>Etapa: <strong>{o.etapa ?? "—"}</strong></p>
              <p>Cidade: <strong>{o.cidade ?? "—"}</strong></p>
              <p>Consultor: <strong>{o.consultor ?? "sem atribuicao"}</strong></p>
              <p>Parado: <strong>{labelDias(o.diasParado)}</strong></p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}
