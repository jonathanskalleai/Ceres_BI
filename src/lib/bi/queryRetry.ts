import { isBiAbortError } from "@/lib/bi/runtime";

const TRANSIENT_ERROR = /failed to fetch|networkerror|network error|load failed|timeout|timed out|temporarily unavailable|bad gateway|gateway timeout|service unavailable|upstream/i;

/**
 * Transport failures are safe to retry: the request did not produce a usable
 * response and the user should not have to discover the retry button. Contract
 * errors and cancellations stay terminal so a malformed payload is never
 * hidden behind a second request.
 */
export function isBiTransientError(error: unknown): boolean {
  if (isBiAbortError(error)) return false;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; message?: unknown; status?: unknown; code?: unknown };
  if (String(candidate.name ?? "") === "BiContractError") return false;

  const status = Number(candidate.status);
  if (Number.isFinite(status) && [408, 425, 429, 500, 502, 503, 504].includes(status)) return true;

  const message = String(candidate.message ?? error).toLowerCase();
  return TRANSIENT_ERROR.test(message);
}

/** QueryClient policy for transport recovery without retrying every SQL error. */
export function shouldRetryBiQuery(failureCount: number, error: unknown): boolean {
  return isBiTransientError(error) && failureCount < 2;
}

/** Stagger retries so a brief network flap does not create another RPC burst. */
export function biQueryRetryDelay(retryAttempt: number, error: unknown): number {
  if (!isBiTransientError(error)) return 1_000;
  return Math.min(2_000, 750 * 2 ** retryAttempt);
}

/** Existing Ações RPCs keep their single retry for server errors and gain a
 * second attempt only for transport failures. */
export function shouldRetryAcoesQuery(failureCount: number, error: unknown): boolean {
  if (isBiAbortError(error)) return false;
  if (error && typeof error === "object" && String((error as { name?: unknown }).name ?? "") === "BiContractError") {
    return false;
  }
  return failureCount < (isBiTransientError(error) ? 2 : 1);
}
