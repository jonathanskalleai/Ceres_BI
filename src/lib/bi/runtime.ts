import {
  BiContractError,
  issue,
} from "@/types/biRuntime";

export { BiContractError } from "@/types/biRuntime";
export type { BiEnvelope, BiIssue, BiRuntimeStatus } from "@/types/biRuntime";

type JsonRecord = Record<string, unknown>;

/** True only for numbers that are safe to send to charts/formatters. */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Supabase JSON RPCs have appeared in three shapes over time:
 *   object, [object], and { data: object, meta: ... }.
 * Do not unwrap arbitrary arrays: a list RPC is a valid list and must remain a
 * list.  Object RPCs use the one-element-array convention, including a single
 * null value (which the validator will reject explicitly when an object is
 * required).
 */
export function unwrapBiPayload<T = unknown>(payload: unknown): T {
  let value = payload;

  if (isRecord(value) && "data" in value && ("meta" in value || "status" in value)) {
    value = value.data;
  }

  if (Array.isArray(value) && value.length === 1) {
    value = value[0];
  }

  return value as T;
}

export function requireRecord(value: unknown, path = "payload"): JsonRecord {
  if (!isRecord(value)) {
    throw new BiContractError(
      `${path} precisa ser um objeto JSON`,
      [issue("OBJECT_REQUIRED", `${path} precisa ser um objeto JSON`, path)],
      "BI_CONTRACT_INVALID",
    );
  }
  return value;
}

export function requireArray(value: unknown, path = "payload"): unknown[] {
  if (!Array.isArray(value)) {
    throw new BiContractError(
      `${path} precisa ser uma lista`,
      [issue("ARRAY_REQUIRED", `${path} precisa ser uma lista`, path)],
      "BI_CONTRACT_INVALID",
    );
  }
  return value;
}

export function requireFiniteNumber(value: unknown, path: string): number {
  if (!isFiniteNumber(value)) {
    throw new BiContractError(
      `${path} precisa ser um numero finito`,
      [issue("FINITE_NUMBER_REQUIRED", `${path} precisa ser um numero finito`, path)],
      "BI_CONTRACT_NUMBER",
    );
  }
  return value;
}

function isValidLatitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -180 && value <= 180;
}

export function isValidCoordinate(lat: unknown, lon: unknown): lat is number {
  return isValidLatitude(lat) && isValidLongitude(lon);
}

export function isBiAbortError(error: unknown): boolean {
  if (error instanceof BiContractError && error.code === "BI_REQUEST_ABORTED") return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; code?: unknown; message?: unknown };
  const name = String(candidate.name ?? "").toLowerCase();
  const code = String(candidate.code ?? "").toLowerCase();
  const message = String(candidate.message ?? "").toLowerCase();
  return name === "aborterror"
    || code === "abort_err"
    || code === "aborted"
    || message.includes("aborted")
    || message.includes("cancelled")
    || message.includes("canceled");
}

/** Normalize fetch/Supabase cancellation into a stable, non-retryable error. */
export function normalizeBiError(error: unknown): Error {
  if (isBiAbortError(error)) {
    return new BiContractError(
      "Consulta cancelada porque os filtros mudaram",
      [issue("REQUEST_ABORTED", "A consulta anterior foi cancelada", undefined, "warning")],
      "BI_REQUEST_ABORTED",
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}
