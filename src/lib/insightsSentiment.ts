/**
 * Keyword lists and helpers for CRM observation sentiment analysis.
 * Pure functions — no React dependencies.
 */

export const POSITIVE_KEYWORDS = [
  "venda", "negócio", "interesse", "fechamento", "intenção", "pedido",
  "interessado", "comprar", "aprovado", "parceria", "gostou", "confirmar",
  "confirmou", "faturar", "avançar", "definiu", "fechou", "satisfeito",
] as const;

export const NEGATIVE_KEYWORDS = [
  "não", "problema", "dificuldade", "cancelar", "desistiu", "reclamação",
  "atraso", "atrasado", "caro", "preço alto", "concorrência", "concorrente",
  "financeiro", "sem condição", "safra ruim", "parado", "negou", "indeciso",
  "defeito", "quebrou", "prejuízo", "insatisfeito", "sem interesse",
] as const;

export const PRODUCT_KEYWORDS = [
  "plataforma", "plantadeira", "colheitadeira", "trator", "pulverizador",
  "descompactador", "drone", "gps", "piloto", "semeadeira", "distribuidor",
  "calcário", "terrus", "draper", "ap 360", "gts", "hardox", "precisão",
  "fertilizante", "adubo", "silo", "autopilot",
] as const;

export type KeywordList = readonly string[];

/**
 * Counts how many times each keyword appears in `text` (case-insensitive).
 * Returns only keywords with count > 0.
 */
export function countKeywords(text: string, keywords: KeywordList): Record<string, number> {
  const lower = text.toLowerCase();
  const result: Record<string, number> = {};
  for (const kw of keywords) {
    let count = 0;
    let idx = 0;
    while ((idx = lower.indexOf(kw, idx)) !== -1) {
      count++;
      idx += kw.length;
    }
    if (count > 0) result[kw] = count;
  }
  return result;
}

/** Sort keyword counts descending and return as [{name, value}] array. */
export function rankKeywords(counts: Record<string, number>): Array<{ name: string; value: number }> {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
}

export const COLORS_POS = "var(--voux-success)";
export const COLORS_NEG = "var(--voux-danger)";
export const INSIGHT_CHART_COLORS = [
  "var(--voux-info)", "var(--voux-success)", "var(--voux-warning)",
  "hsl(var(--chart-6))", "var(--voux-danger)", "hsl(var(--chart-4))",
  "hsl(var(--chart-3))", "hsl(var(--chart-1))",
];
