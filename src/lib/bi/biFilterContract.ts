/**
 * Canonical filter contract shared by dashboard controls, query keys and
 * telemetry. Empty strings and empty arrays are normalized to `null` so two
 * equivalent filter selections cannot create separate cache entries.
 */
export type BiFilterKey =
  | "from"
  | "to"
  | "categoria"
  | "funil"
  | "funis"
  | "vendedor"
  | "cidade"
  | "tipoAcao"
  | "statusNegocio"
  | "produto"
  | "origem"
  | "banco"
  | "motivoPerda"
  | "condicao";

export interface BiFilterState {
  from: string | null;
  to: string | null;
  categoria: string | null;
  funil: string | null;
  funis: string[] | null;
  vendedor: string | null;
  cidade: string | null;
  tipoAcao: string | null;
  statusNegocio: string | null;
  produto: string | null;
  origem: string | null;
  banco: string | null;
  motivoPerda: string | null;
  condicao: string | null;
}

export type BiFilterInput = Partial<Record<BiFilterKey, string | string[] | null | undefined>>;

const FILTER_KEYS: readonly BiFilterKey[] = [
  "from", "to", "categoria", "funil", "funis", "vendedor", "cidade",
  "tipoAcao", "statusNegocio", "produto", "origem", "banco", "motivoPerda", "condicao",
];

function normalizeText(value: string | string[] | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeBiFilters(input: BiFilterInput = {}): BiFilterState {
  const output = {} as BiFilterState;
  FILTER_KEYS.forEach((key) => {
    const value = input[key];
    if (key === "funis") {
      const values = Array.isArray(value)
        ? [...new Set(value.map((item) => item.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
        : [];
      output[key] = values.length > 0 ? values : null;
      return;
    }
    output[key] = normalizeText(value);
  });
  return output;
}

export function biFiltersKey(input: BiFilterInput = {}): string {
  return JSON.stringify(normalizeBiFilters(input));
}

export function hasBiFilter(input: BiFilterInput = {}): boolean {
  return Object.values(normalizeBiFilters(input)).some((value) => value !== null);
}
