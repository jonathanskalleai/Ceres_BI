import { supabase } from "@/integrations/supabase/client";
import { resilientFetch } from "@/lib/network/resilientFetch";

interface BiApiEnvelope<T> {
  status: "ok" | "partial" | "error";
  data: T | null;
  issues: Array<{ code: string; message: string; severity?: string; retryable?: boolean }>;
  requestId: string;
  fetchedAt: string;
}

const BI_API_ENABLED = import.meta.env.VITE_BI_API_ENABLED === "true";
const BI_API_ROUTES = new Set(
  String(import.meta.env.VITE_BI_API_ROUTES ?? "")
    .split(",")
    .map((route) => route.trim())
    .filter(Boolean),
);

export function isBiApiRouteEnabled(route: string): boolean {
  return BI_API_ENABLED && BI_API_ROUTES.has(route);
}

export async function fetchBiApi<T>(
  path: string,
  params: Record<string, string | number | null | undefined>,
  signal?: AbortSignal,
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const response = await resilientFetch(`/api/bi/v1${path}${query.size ? `?${query.toString()}` : ""}`, {
    method: "GET",
    signal,
    headers: {
      Accept: "application/json",
      "X-Request-Id": requestId,
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  });

  const envelope = await response.json() as BiApiEnvelope<T>;
  if (!response.ok || envelope.status === "error" || envelope.data === null) {
    throw new Error(envelope.issues?.[0]?.message ?? `BI API indisponível (${response.status})`);
  }
  return envelope.data;
}
