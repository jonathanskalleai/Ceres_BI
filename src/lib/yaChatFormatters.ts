import { formatDateBR } from "@/lib/dateUtils";

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NUMBER_FORMATTER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const CURRENCY_TOKEN = /(R\$\s*|US\$\s*|USD\s*|\$\s*)(-?(?:\d[\d.,]*)(?:\s+\d[\d.,]+)*)/gi;
const ISO_DATE_TIME_TOKEN = /\b(20\d{2})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?\b/g;
const ISO_DATE_TOKEN = /\b(20\d{2})-(\d{2})-(\d{2})\b/g;
const US_DATE_TOKEN = /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g;

function parseNumber(value: string): number | null {
  const clean = value.replace(/\s/g, "").replace(/[.,;:!?]+$/, "");
  if (!clean) return null;
  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  let integer = clean;
  let fraction = "";

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const decimalIndex = clean.lastIndexOf(decimalSeparator);
    integer = clean.slice(0, decimalIndex).replace(/[.,]/g, "");
    fraction = clean.slice(decimalIndex + 1).replace(/\D/g, "");
  } else if (lastComma >= 0) {
    const decimals = clean.length - lastComma - 1;
    if (decimals > 0 && decimals <= 2) {
      integer = clean.slice(0, lastComma).replace(/\./g, "").replace(/,/g, "");
      fraction = clean.slice(lastComma + 1);
    } else {
      integer = clean.replace(/,/g, "");
    }
  } else if (lastDot >= 0) {
    const decimals = clean.length - lastDot - 1;
    if (decimals > 0 && decimals <= 2) {
      integer = clean.slice(0, lastDot).replace(/,/g, "");
      fraction = clean.slice(lastDot + 1);
    } else {
      integer = clean.replace(/\./g, "");
    }
  }

  const parsed = Number(`${integer || "0"}.${fraction || "0"}`);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrencyToken(_match: string, _prefix: string, rawValue: string): string {
  const trailing = rawValue.match(/[.,;:!?]+$/)?.[0] ?? "";
  const value = parseNumber(rawValue);
  return value === null ? _match : `${BRL_FORMATTER.format(value).replace(/\u00a0/g, " ")}${trailing}`;
}

function formatIsoDateTime(_match: string, year: string, month: string, day: string, hour: string, minute: string): string {
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

function formatUsDate(_match: string, first: string, second: string, year: string): string {
  const month = Number(first);
  const day = Number(second);
  return day > 12 && month <= 12 ? `${second.padStart(2, "0")}/${first.padStart(2, "0")}/${year}` : _match;
}

/** Normalizes model prose without interpreting or changing its factual values. */
export function formatChatText(text: string): string {
  return text
    .replace(CURRENCY_TOKEN, formatCurrencyToken)
    .replace(ISO_DATE_TIME_TOKEN, formatIsoDateTime)
    .replace(ISO_DATE_TOKEN, (_match, year: string, month: string, day: string) => `${day}/${month}/${year}`)
    .replace(US_DATE_TOKEN, formatUsDate)
    .replace(/\b(-?\d+(?:\.\d+)?)\s*%/g, (_match, value: string) => `${NUMBER_FORMATTER.format(Number(value))}%`);
}

/** Formats evidence timestamps in the business timezone, preserving date-only values. */
export function formatChatDateTime(value?: string | null): string {
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDateBR(value);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return formatChatText(value);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(parsed);
}

/** Formats scalar values in the unit declared by the semantic catalog. */
export function formatEvidenceValue(value: unknown, unit?: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value !== "number") return formatChatText(String(value));
  if (unit?.toUpperCase().includes("BRL")) return BRL_FORMATTER.format(value).replace(/\u00a0/g, " ");
  if (unit === "%") return `${NUMBER_FORMATTER.format(value)}%`;
  return NUMBER_FORMATTER.format(value);
}
