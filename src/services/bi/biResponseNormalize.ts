import { biQuality } from "@/lib/bi/biQualityStore";
import { BiContractError, issue } from "@/types/biRuntime";

/** Runtime guards shared by the legacy BI RPC adapters. */

export type JsonRecord = Record<string, unknown>;

export function asRecord(value: unknown): JsonRecord {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate !== null && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate as JsonRecord
    : {};
}

export function arrayOrEmpty<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

/**
 * Merge an RPC payload with a complete shape while rejecting malformed nested
 * objects/arrays. Missing data stays visibly empty instead of throwing in a
 * chart component or being confused with a valid zero.
 */
export function normalizeRpcObject<T extends JsonRecord>(
  value: unknown,
  defaults: T,
  nestedObjects: (keyof T)[] = [],
  arrays: (keyof T)[] = [],
  source = "bi.rpc",
): T {
  const raw = asRecord(value);
  if (Object.keys(raw).length === 0) {
    throw new BiContractError(
      `Resposta vazia para ${source}`,
      [issue("BI_CONTRACT_PAYLOAD_EMPTY", "A consulta não retornou um objeto de dados", source)],
      "BI_CONTRACT_MISSING",
    );
  }
  const normalized: JsonRecord = { ...defaults, ...raw };
  const missing: string[] = [];

  nestedObjects.forEach((key) => {
    const defaultValue = defaults[key];
    const rawValue = raw[key];
    normalized[key as string] = rawValue !== null && typeof rawValue === "object" && !Array.isArray(rawValue)
      ? { ...(defaultValue as JsonRecord), ...(rawValue as JsonRecord) }
      : (() => {
        missing.push(String(key));
        return defaultValue;
      })();
  });

  arrays.forEach((key) => {
    if (!Array.isArray(raw[key])) {
      missing.push(String(key));
      normalized[key as string] = defaults[key];
    }
  });

  if (missing.length > 0) {
    biQuality.record({
      source,
      status: "partial",
      issues: missing.map((field) => ({
        code: "BI_CONTRACT_FIELD_MISSING",
        message: `O campo ${field} não foi retornado pela consulta.`,
        source: field,
      })),
      occurredAt: new Date().toISOString(),
    });
  } else {
    biQuality.clear(source);
  }

  return normalized as T;
}
