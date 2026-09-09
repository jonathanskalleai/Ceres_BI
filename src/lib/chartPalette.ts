/**
 * Paleta compartilhada pelos graficos SVG e ECharts.
 *
 * Fica em um modulo separado do tema ECharts para que telas que usam apenas
 * SVG (como Acoes e boa parte do CRM) nao precisem baixar o runtime completo
 * do ECharts no primeiro carregamento.
 */
export const CHART_COLORS = [
  "#4caf7a", // verde sóbrio (sucesso)
  "#d4a05a", // âmbar (warning)
  "#c97565", // terracotta (danger)
  "#8ea3b8", // slate-blue (info)
  "#7a9b6f", // sage green
  "#6e542f", // marrom muted
  "#d4b896", // champagne
  "#e06060", // vermelho sóbrio
] as const;

export const ACCENT_COLOR = "#d4a05a";
export const POSITIVE_COLOR = "#4caf7a";
export const NEGATIVE_COLOR = "#c97565";
