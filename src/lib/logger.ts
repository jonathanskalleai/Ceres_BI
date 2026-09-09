type LogFields = Record<string, unknown>;

function safeFields(fields?: LogFields): LogFields {
  if (!fields) return {};
  return Object.fromEntries(Object.entries(fields).filter(([key]) => !/(token|authorization|password|secret|email|cpf|phone|sql)/i.test(key)));
}

export function logClientError(event: string, error: unknown, fields?: LogFields): void {
  const detail = error instanceof Error ? error.message : "unknown_error";
  console.error(`[${event}]`, { error: detail.slice(0, 240), ...safeFields(fields) });
}

export function logClientWarning(event: string, error: unknown, fields?: LogFields): void {
  const detail = error instanceof Error ? error.message : "unknown_error";
  console.warn(`[${event}]`, { error: detail.slice(0, 240), ...safeFields(fields) });
}
