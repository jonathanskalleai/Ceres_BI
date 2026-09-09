type LogFields = Record<string, unknown>;

const ERROR_TRACKING_ENDPOINT = import.meta.env.VITE_ERROR_TRACKING_ENDPOINT as string | undefined;

function safeFields(fields?: LogFields): LogFields {
  if (!fields) return {};
  return Object.fromEntries(Object.entries(fields).filter(([key]) => !/(token|authorization|password|secret|email|cpf|phone|sql)/i.test(key)));
}

export function logClientError(event: string, error: unknown, fields?: LogFields): void {
  reportClientError(event, error, fields);
}

export function logClientWarning(event: string, error: unknown, fields?: LogFields): void {
  const detail = error instanceof Error ? error.message : "unknown_error";
  console.warn(`[${event}]`, { error: detail.slice(0, 240), ...safeFields(fields) });
}

/**
 * Report a client failure without putting credentials, PII or full payloads in
 * the browser log or in an optional external tracking channel.
 */
export function reportClientError(event: string, error: unknown, fields?: LogFields): void {
  const detail = error instanceof Error ? error.message : String(error || "unknown_error");
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
