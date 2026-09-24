import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, warningMock, metricMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  warningMock: vi.fn(),
  metricMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: getSessionMock } },
}));
vi.mock("@/lib/logger", () => ({ logClientMetric: metricMock, logClientWarning: warningMock }));

import { fetchBiApi, fetchBiRpc, isBiApiEnabled } from "@/services/bi/biApiTransport";
import { biQuality } from "@/lib/bi/biQualityStore";

beforeEach(() => {
  vi.unstubAllEnvs();
  getSessionMock.mockReset();
  warningMock.mockReset();
  metricMock.mockReset();
  biQuality.clearAll();
  getSessionMock.mockResolvedValue({ data: { session: { access_token: "test-token" } } });
});

describe("biApiTransport", () => {
  it("keeps the migration disabled unless the explicit flag is true", () => {
    expect(isBiApiEnabled()).toBe(false);
    vi.stubEnv("VITE_BI_API_ENABLED", "true");
    expect(isBiApiEnabled()).toBe(true);
  });

  it("sends the session token and unwraps the stable API envelope", async () => {
    vi.stubEnv("VITE_BI_API_ENABLED", "true");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        status: "ok",
        data: { kpis: { totalAcoes: 4 } },
        requestId: "req-1",
        fetchedAt: "2026-09-23T00:00:00Z",
        metrics: { query_ms: 12.5, api_ms: 14.2, payload_bytes: 42 },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    await expect(fetchBiApi<{ kpis: { totalAcoes: number } }>("/acoes/core", { from: "2026-01-01" }))
      .resolves.toEqual({ kpis: { totalAcoes: 4 } });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bi/acoes/core?from=2026-01-01",
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: "application/json", Authorization: "Bearer test-token" }),
      }),
    );
    expect(metricMock).toHaveBeenCalledWith("bi_query", expect.objectContaining({
      request_id: "req-1",
      query_ms: 12.5,
      api_ms: 14.2,
      payload_bytes: 42,
      frontend_ms: expect.any(Number),
    }));
    fetchMock.mockRestore();
  });

  it("does not convert a partial response into fake zeros", async () => {
    vi.stubEnv("VITE_BI_API_ENABLED", "true");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        status: "partial",
        data: { kpis: { totalAcoes: 4 } },
        issues: [{ code: "MAP_TIMEOUT", message: "Mapa indisponível" }],
        requestId: "req-2",
        metrics: { query_ms: 4, api_ms: 5, payload_bytes: 18 },
      }), { status: 200 }),
    );
    await expect(fetchBiApi("/acoes/core", {})).resolves.toEqual({ kpis: { totalAcoes: 4 } });
    expect(warningMock).toHaveBeenCalledWith("bi.api_partial", expect.any(Error), expect.objectContaining({ requestId: "req-2" }));
    fetchMock.mockRestore();
  });

  it("fails closed when the API envelope reports an error", async () => {
    vi.stubEnv("VITE_BI_API_ENABLED", "true");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        status: "error",
        issues: [{ code: "BI_QUERY_FAILED", message: "Bloco indisponível" }],
        requestId: "req-3",
      }), { status: 200 }),
    );
    await expect(fetchBiApi("/acoes/core", {})).rejects.toThrow("Bloco indisponível");
    fetchMock.mockRestore();
  });

  it("posts every generic BI RPC through the backend gateway", async () => {
    vi.stubEnv("VITE_BI_API_ENABLED", "true");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        status: "ok",
        data: { rows: [], total: 0 },
        requestId: "req-rpc-1",
        fetchedAt: "2026-09-23T00:00:00Z",
        metrics: { query_ms: 3, api_ms: 4, payload_bytes: 30 },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    await expect(fetchBiRpc("rpc_pedidos_bi", { p_from: "2026-01-01", p_to: "2026-01-31" }))
      .resolves.toEqual({ rows: [], total: 0 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bi/rpc/rpc_pedidos_bi",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ params: { p_from: "2026-01-01", p_to: "2026-01-31" } }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        }),
      }),
    );
    expect(metricMock).toHaveBeenCalledWith("bi_query", expect.objectContaining({
      rpc: "rpc_pedidos_bi",
      endpoint: "rpc.rpc_pedidos_bi",
    }));
    fetchMock.mockRestore();
  });
});
