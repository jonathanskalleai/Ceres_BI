import { supabase } from "@/integrations/supabase/client";
import { resilientFetch } from "@/lib/network/resilientFetch";
import { BiContractError, issue } from "@/types/biRuntime";
import { logClientMetric, logClientWarning } from "@/lib/logger";

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
  metrics?: {
    query_ms?: number;
    api_ms?: number;
    frontend_ms?: number;
    payload_bytes?: number;
  };
}

/** Feature flag is evaluated at call time so tests and runtime config stay deterministic. */
export function isBiApiEnabled(): boolean {
  return String(import.meta.env.VITE_BI_API_ENABLED ?? "").toLowerCase() === "true";
}

function apiBaseUrl(): string {
  return String(import.meta.env.VITE_BI_API_BASE_URL ?? "/api/bi").replace(/\/$/, "");
}

function safeMetricRequestId(value: string | undefined): string {
  const candidate = String(value ?? "").slice(0, 128);
  return /^[A-Za-z0-9._:-]{1,128}$/.test(candidate) ? candidate : "client-unknown";
}

function inferCase(params: Record<string, unknown>): "monthly" | "annual" | "custom" {
  const from = typeof params.from === "string" ? params.from : "";
  const to = typeof params.to === "string" ? params.to : "";
  const fromMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from);
  const toMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(to);
  if (!fromMatch || !toMatch) return "custom";
  if (fromMatch[1] === toMatch[1] && fromMatch[2] === toMatch[2] && fromMatch[3] === "01") {
    const lastDays = new Date(Number(fromMatch[1]), Number(fromMatch[2]), 0).getDate();
    if (Number(toMatch[3]) === lastDays) return "monthly";
  }
  if (from === `${fromMatch[1]}-01-01` && to === `${toMatch[1]}-12-31` && fromMatch[1] === toMatch[1]) {
    return "annual";
  }
  return "custom";
}

function rpcForPath(path: string): string {
  const names: Record<string, string> = {
    "/acoes/core": "rpc_acoes_bi_periodo",
    "/acoes/detalhe": "rpc_acoes_detalhe",
    "/acoes/funil": "rpc_acoes_funil_gestao_periodo",
    "/acoes/mapa": "rpc_acoes_mapa_oportunidades",
  };
  return names[path] ?? "unknown";
}

function canonicalRoute(path: string): string {
  return path.startsWith("/api/bi/") ? path : `/api/bi${path.startsWith("/") ? path : `/${path}`}`;
}

function endpointForPath(path: string): string {
  return path.replace(/^\/+|\/+$/g, "").replaceAll("/", ".");
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
  const frontendStartedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
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
  const frontendMs = Math.max(
    0,
    (typeof performance !== "undefined" ? performance.now() : Date.now()) - frontendStartedAt,
  );
  logClientMetric("bi_query", {
    request_id: safeMetricRequestId(envelope.requestId),
    dashboard_id: "bi_acoes",
    route: canonicalRoute(path),
    endpoint: endpointForPath(path),
    rpc: rpcForPath(path),
    case: inferCase(params),
    status: envelope.status,
    query_ms: envelope.metrics?.query_ms ?? null,
    api_ms: envelope.metrics?.api_ms ?? null,
    frontend_ms: Number(frontendMs.toFixed(3)),
    payload_bytes: envelope.metrics?.payload_bytes ?? null,
  });
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
