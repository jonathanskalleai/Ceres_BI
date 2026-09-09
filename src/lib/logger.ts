type LogFields = Record<string, unknown>;

const ERROR_TRACKING_ENDPOINT = import.meta.env.VITE_ERROR_TRACKING_ENDPOINT as string | undefined;
const SENSITIVE_TEXT = /(?:authorization\s*[:=]\s*bearer\s+\S+|bearer\s+\S+|sk-[a-z0-9_-]{8,}|(?:password|senha|secret|token|api[_ -]?key|authorization)\s*[:=]\s*\S+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[-.\s]?\d{4})/gi;

function safeText(value: unknown): string {
  return String(value || "unknown_error").replace(SENSITIVE_TEXT, "[redacted]").slice(0, 240);
}

function safeFields(fields?: LogFields): LogFields {
  if (!fields) return {};
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([key]) => !/(token|authorization|password|secret|email|cpf|phone|sql)/i.test(key))
      .map(([key, value]) => [key, typeof value === "string" ? safeText(value) : value]),
  );
}

export function logClientError(event: string, error: unknown, fields?: LogFields): void {
  reportClientError(event, error, fields);
}

export function logClientWarning(event: string, error: unknown, fields?: LogFields): void {
  const detail = safeText(error instanceof Error ? error.message : error);
  console.warn(`[${event}]`, { error: detail, ...safeFields(fields) });
}

/**
 * Report a client failure without putting credentials, PII or full payloads in
 * the browser log or in an optional external tracking channel.
 */
export function reportClientError(event: string, error: unknown, fields?: LogFields): void {
  const detail = safeText(error instanceof Error ? error.message : error);
  const safe = safeFields(fields);
  console.error(`[${event}]`, { error: detail.slice(0, 240), ...safe });
  if (!ERROR_TRACKING_ENDPOINT) return;
  void fetch(ERROR_TRACKING_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: event.slice(0, 120), error: detail.slice(0, 240), fields: safe, at: new Date().toISOString() }),
    keepalive: true,
  }).catch((trackingError: unknown) => {
    logClientWarning("client_error_tracking_failed", trackingError, { event });
  });
}
