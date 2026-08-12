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
 * Uma oportunidade do funil no período (/bi/acoes). A unidade é o NEGÓCIO — o
 * mesmo cliente pode ter vários negócios, cada um com valor, etapa e resultado.
 */
export interface OportunidadePoint {
  negocio: string;
  cliente: string | null;
  cidade: string | null;
  etapa: string | null;
  valor: number | null;
  consultor: string | null;
  situacao: "aberto" | "ganho" | "perdido";
  acoesNoPeriodo: number;
  ultimaAcaoPeriodo: string | null;
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

/** Azul forte para negócios em andamento: mantém contraste no mapa claro. */
export const OPORTUNIDADE_ABERTA_PIN_COLOR = "#2563eb";

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
      <circle cx="9" cy="9" r="8.5" fill="${color}" stroke="#0f172a" stroke-width="1"/>
      <circle cx="6.5" cy="5.5" r="3" fill="rgba(255,255,255,0.38)"/>
      <circle cx="5.5" cy="4.5" r="1.2" fill="rgba(255,255,255,0.55)"/>
      <line x1="9" y1="17" x2="9" y2="42" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`,
    className: "",
    iconSize: [18, 42],
    iconAnchor: [9, 42],
    popupAnchor: [0, -42],
    tooltipAnchor: [0, -42],
  });
