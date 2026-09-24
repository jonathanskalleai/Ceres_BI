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
): T {
  const raw = asRecord(value);
  const normalized: JsonRecord = { ...defaults, ...raw };

  nestedObjects.forEach((key) => {
    const defaultValue = defaults[key];
    const rawValue = raw[key];
    normalized[key as string] = rawValue !== null && typeof rawValue === "object" && !Array.isArray(rawValue)
      ? { ...(defaultValue as JsonRecord), ...(rawValue as JsonRecord) }
      : defaultValue;
  });

  arrays.forEach((key) => {
    if (!Array.isArray(raw[key])) normalized[key as string] = defaults[key];
  });

  return normalized as T;
}
