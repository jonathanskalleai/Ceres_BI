import { supabase } from "@/integrations/supabase/client";
import { resilientFetch } from "@/lib/network/resilientFetch";
import { BiContractError, issue } from "@/types/biRuntime";
import { logClientWarning } from "@/lib/logger";

export interface BiApiIssue {
  code: string;
  message: string;
  source?: string | null;
}

export interface BiApiEnvelope<T> {
  status: "ok" | "partial" | "error";
  data?: T;
  issues?: BiApiIssue[];
  requestId?: string;
  fetchedAt?: string;
}

/** Feature flag is evaluated at call time so tests and runtime config stay deterministic. */
export function isBiApiEnabled(): boolean {
  return String(import.meta.env.VITE_BI_API_ENABLED ?? "").toLowerCase() === "true";
}

function apiBaseUrl(): string {
  return String(import.meta.env.VITE_BI_API_BASE_URL ?? "/api/bi").replace(/\/$/, "");
}

function buildQuery(params: Record<string, unknown>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

function responseError(response: Response, payload: unknown): Error {
  const detail = typeof payload === "object" && payload !== null && "detail" in payload
    ? String((payload as { detail?: unknown }).detail ?? "")
    : `BI API respondeu HTTP ${response.status}`;
  return Object.assign(new Error(detail), { status: response.status, code: "BI_API_HTTP_ERROR" });
}

export async function fetchBiApi<T>(
  path: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  headers["X-Request-Id"] = requestId;

  const response = await resilientFetch(
    `${apiBaseUrl()}${path}${buildQuery(params)}`,
    { headers, signal },
    // Do not duplicate an expensive RPC when the BI API is already handling it.
    { maxAttempts: 1, timeoutMs: 35_000 },
  );
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw Object.assign(new Error("Resposta inválida do serviço BI"), { cause: error, code: "BI_API_INVALID_JSON" });
  }
  if (!response.ok) throw responseError(response, payload);

  const envelope = payload as BiApiEnvelope<T>;
  if (!envelope || !["ok", "partial", "error"].includes(envelope.status)) {
    throw new BiContractError(
      "Resposta do serviço BI não possui envelope válido",
      [issue("BI_API_ENVELOPE_INVALID", "status precisa ser ok, partial ou error")],
      "BI_CONTRACT_INVALID",
    );
  }
  if (envelope.status === "error") {
    const firstIssue = envelope.issues?.[0];
    throw Object.assign(
      new Error(firstIssue?.message ?? "O serviço BI não conseguiu carregar os dados"),
      { code: firstIssue?.code ?? "BI_API_QUERY_FAILED", requestId: envelope.requestId },
    );
  }
  if (envelope.status === "partial") {
    logClientWarning("bi.api_partial", new Error("Resposta parcial da API BI"), {
      requestId: envelope.requestId,
      issueCount: envelope.issues?.length ?? 0,
      path,
    });
  }
  if (envelope.data === undefined) {
    throw new BiContractError(
      "Resposta do serviço BI não possui dados",
      [issue("BI_API_DATA_MISSING", "data ausente em resposta não-erro")],
      "BI_CONTRACT_MISSING",
    );
  }
  return envelope.data;
}
