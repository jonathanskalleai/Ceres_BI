const TRANSIENT_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const TRANSIENT_ERROR = /failed to fetch|networkerror|network error|network failed|load failed|timeout|timed out|tempo esgotado|tempo excedido|temporarily unavailable|bad gateway|gateway timeout|service unavailable|upstream/i;

export interface ResilientFetchOptions {
  /** Maximum number of attempts, including the first request. */
  maxAttempts?: number;
  /** Timeout per attempt. Zero disables the client-side timeout. */
  timeoutMs?: number;
  /** Delay before the next attempt. Defaults to exponential backoff. */
  retryDelayMs?: number;
}

export function isTransientNetworkError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === "object") {
    const candidate = error as { name?: unknown; message?: unknown; status?: unknown; code?: unknown };
    const name = String(candidate.name ?? "").toLowerCase();
    const code = String(candidate.code ?? "").toLowerCase();
    if (name === "aborterror" || code === "abort_err" || code === "aborted") return false;
    if (name === "timeouterror") return true;
    const status = Number(candidate.status);
    if (Number.isFinite(status)) return TRANSIENT_STATUS_CODES.has(status);
    return TRANSIENT_ERROR.test(String(candidate.message ?? error));
  }
  return TRANSIENT_ERROR.test(String(error));
}

function isRetryableMethod(method: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

function waitForRetry(delayMs: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
}

/** Adds bounded transport recovery to safe reads. Mutating requests stay single-attempt by default. */
export async function resilientFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: ResilientFetchOptions = {},
): Promise<Response> {
  const method = (init?.method
    ?? (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET"))
    .toUpperCase();
  const safeMethod = isRetryableMethod(method);
  const maxAttempts = Math.max(1, options.maxAttempts ?? (safeMethod ? 2 : 1));
  const timeoutMs = options.timeoutMs ?? (safeMethod ? 20_000 : 0);
  const baseDelayMs = options.retryDelayMs ?? 400;
  const parentSignal = init?.signal;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = timeoutMs > 0
      ? globalThis.setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : undefined;
    const abortFromParent = () => controller.abort(parentSignal?.reason);

    if (parentSignal?.aborted) abortFromParent();
    else parentSignal?.addEventListener("abort", abortFromParent, { once: true });

    try {
      const response = await globalThis.fetch(input, { ...init, signal: controller.signal });
      if (safeMethod && TRANSIENT_STATUS_CODES.has(response.status) && attempt < maxAttempts) {
        await waitForRetry(Math.min(2_000, baseDelayMs * 2 ** (attempt - 1)));
        continue;
      }
      return response;
    } catch (error) {
      lastError = timedOut
        ? Object.assign(new Error("Tempo esgotado ao carregar os dados."), { name: "TimeoutError" })
        : error;
      if (parentSignal?.aborted || !isTransientNetworkError(lastError) || attempt === maxAttempts) {
        throw lastError;
      }
      await waitForRetry(Math.min(2_000, baseDelayMs * 2 ** (attempt - 1)));
    } finally {
      if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
      parentSignal?.removeEventListener("abort", abortFromParent);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function retryTransient<T>(
  operation: () => Promise<T>,
  options: Pick<ResilientFetchOptions, "maxAttempts" | "retryDelayMs"> = {},
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 2);
  const baseDelayMs = options.retryDelayMs ?? 400;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientNetworkError(error) || attempt === maxAttempts) throw error;
      await waitForRetry(Math.min(2_000, baseDelayMs * 2 ** (attempt - 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
