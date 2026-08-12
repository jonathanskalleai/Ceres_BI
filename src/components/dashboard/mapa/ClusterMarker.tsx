import { useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { OPORTUNIDADE_ABERTA_PIN_COLOR, type OportunidadePoint } from "@/components/dashboard/mapa";
import { fmtBRL } from "@/lib/formatters";

interface ClusterMarkerProps {
  points: OportunidadePoint[];
  lat: number;
  lng: number;
}

const MAX_POPUP_ITEMS = 5;

function corCluster(points: OportunidadePoint[]): string {
  const situacoes = new Set(points.map((p) => p.situacao));
  if (situacoes.size === 1 && situacoes.has("ganho")) return "var(--voux-success)";
  if (situacoes.size === 1 && situacoes.has("perdido")) return "var(--voux-danger)";
  return OPORTUNIDADE_ABERTA_PIN_COLOR;
}

/**
 * Marcador de cluster para pinos agrupados por coordenada (4 decimais).
 *
 * Mantém a mesma linguagem de pino dos negócios individuais e acrescenta o
 * badge numérico quando há mais de um negócio no mesmo ponto.
 */
export function ClusterMarker({ points, lat, lng }: ClusterMarkerProps) {
  const count = points.length;
  const cor = corCluster(points);

  const icon = useMemo(() => {
    return L.divIcon({
      html: `
        <div style="
          position: relative;
          width: 24px;
          height: 44px;
        ">
          <span style="
            position: absolute;
            top: 0;
            left: 3px;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: ${cor};
            border: 1px solid #0f172a;
          "></span>
          <span style="
            position: absolute;
            top: 16px;
            left: 11px;
            width: 2px;
            height: 28px;
            border-radius: 2px;
            background: ${cor};
          "></span>
          <span style="
            position: absolute;
            top: -5px;
            right: -3px;
            min-width: 14px;
            height: 14px;
            padding: 0 2px;
            border-radius: 7px;
            background: var(--voux-ink-800);
            border: 1px solid ${cor};
            color: #fff;
            font-family: var(--voux-font-mono);
            font-size: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">${count}</span>
        </div>
      `,
      className: "",
      iconSize: [24, 44],
      iconAnchor: [12, 44],
      popupAnchor: [0, -44],
    });
  }, [cor, count]);

  const popupContent = useMemo(() => {
    const shown = points.slice(0, MAX_POPUP_ITEMS);
    const remaining = count - MAX_POPUP_ITEMS;
    return { shown, remaining };
  }, [points, count]);

  return (
    <Marker position={[lat, lng]} icon={icon}>
      <Popup>
        <div className="text-[11px] space-y-1 max-w-[200px]">
          {popupContent.shown.map((p, i) => (
            <div key={`${p.negocio}-${i}`} className="flex justify-between gap-2">
              <span className="truncate text-[var(--voux-text-primary)]">{p.cliente ?? p.negocio}</span>
              {p.valor != null && (
                <span className="shrink-0 tabular-nums text-[var(--voux-text-muted)]">{fmtBRL(p.valor)}</span>
              )}
            </div>
          ))}
          {popupContent.remaining > 0 && (
            <p className="text-[var(--voux-text-muted)] italic">e mais {popupContent.remaining}...</p>
          )}
        </div>
      </Popup>
    </Marker>
  );
}
