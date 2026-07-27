import { useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { OportunidadePoint } from "@/components/dashboard/mapa";
import { fmtBRL } from "@/lib/formatters";

interface ClusterMarkerProps {
  points: OportunidadePoint[];
  lat: number;
  lng: number;
}

const MAX_POPUP_ITEMS = 5;

/**
 * Marcador de cluster para pinos agrupados por coordenada (4 decimais).
 *
 * Radius escalado por log2(count), badge numerico top-right, borda danger
 * quando qualquer pino tem diasParado >= 90. Popup com lista compacta.
 */
export function ClusterMarker({ points, lat, lng }: ClusterMarkerProps) {
  const count = points.length;
  const hasDanger = points.some((p) => (p.diasParado ?? 0) >= 90);

  const icon = useMemo(() => {
    // Raio conservador: base 8px + escala log suave. Antes era 14+log2*3 que
    // gerava circulos enormes cobrindo regioes inteiras do mapa.
    const radius = Math.round(8 + Math.log2(count) * 2);
    const borderColor = hasDanger ? "var(--voux-danger)" : "var(--voux-champagne-400)";
    const size = radius * 2;

    return L.divIcon({
      html: `
        <div style="
          position: relative;
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: var(--voux-ink-800);
          border: 2px solid ${borderColor};
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="
            position: absolute;
            top: -4px;
            right: -4px;
            min-width: 14px;
            height: 14px;
            padding: 0 2px;
            border-radius: 7px;
            background: var(--voux-ink-800);
            border: 1px solid ${borderColor};
            color: var(--voux-champagne-400);
            font-family: var(--voux-font-mono);
            font-size: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">${count}</span>
        </div>
      `,
      className: "",
      iconSize: [size, size],
      iconAnchor: [radius, radius],
      popupAnchor: [0, -radius],
    });
  }, [count, hasDanger]);

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
