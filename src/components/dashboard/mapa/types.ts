import L from "leaflet";

// ─── Domain types for the map sub-components ───────────────────────────────

export interface MapRegion {
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

export interface ClientePoint {
  cliente: string;
  cidade: string;
  lat: number;
  lng: number;
  ultimaAcao: string;
  totalAcoes: number;
}

/**
 * Um pino de oportunidade aberta (/bi/acoes). Tipo proprio, e nao reuso de
 * `ClientePoint`, porque a unidade e o NEGOCIO — o mesmo cliente pode ter
 * varios negocios abertos, cada um com valor, etapa e tempo parado diferentes.
 */
export interface OportunidadePoint {
  negocio: string;
  cliente: string | null;
  cidade: string | null;
  etapa: string | null;
  valor: number | null;
  consultor: string | null;
  lat: number;
  lng: number;
  /** NULL quando o negocio nunca teve acao registrada — nao renderizar "null dias". */
  diasParado: number | null;
}

/**
 * Modos do mapa. `oportunidades` foi ACRESCENTADO sem tocar nos dois
 * existentes: `DashboardMapa` continua alternando so entre clientes|regioes.
 */
export type MapViewMode = "clientes" | "regioes" | "oportunidades";

// ─── Shared constants ──────────────────────────────────────────────────────

export const CARD_BASE =
  "relative overflow-hidden rounded-[20px] p-[22px_24px] bg-gradient-to-b from-[var(--voux-card-from)] to-[var(--voux-card-to)] border border-[var(--voux-card-border)] shadow-[var(--voux-card-shadow)]";

export const MONO: React.CSSProperties = {
  fontFamily: "var(--voux-font-mono, 'JetBrains Mono', monospace)",
};

// ─── Utility functions ─────────────────────────────────────────────────────

export const formatCurrency = (v: number): string =>
  v >= 1e6
    ? `R$ ${(v / 1e6).toFixed(1)}M`
    : v >= 1e3
      ? `R$ ${(v / 1e3).toFixed(0)}K`
      : `R$ ${v.toFixed(0)}`;

export const createPinIcon = (color: string): L.DivIcon =>
  L.divIcon({
    html: `<svg width="18" height="42" viewBox="0 0 18 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="9" r="8.5" fill="${color}"/>
      <circle cx="6.5" cy="5.5" r="3" fill="rgba(255,255,255,0.38)"/>
      <circle cx="5.5" cy="4.5" r="1.2" fill="rgba(255,255,255,0.55)"/>
      <line x1="9" y1="17" x2="9" y2="42" stroke="rgba(180,170,160,0.85)" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    className: "",
    iconSize: [18, 42],
    iconAnchor: [9, 42],
    popupAnchor: [0, -42],
    tooltipAnchor: [0, -42],
  });
