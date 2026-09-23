import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: rpcMock },
}));

import { fetchAcoesNegociosPerdidos } from "@/services/bi/acoesNegociosPerdidosService";

describe("fetchAcoesNegociosPerdidos RPC contract", () => {
  beforeEach(() => {
    rpcMock.mockReset().mockResolvedValue({ data: { rows: [], total: 0 }, error: null });
  });

  it("sends p_funis explicitly as null when no funnel filter is active", async () => {
    await fetchAcoesNegociosPerdidos({ from: "2026-01-01", to: "2026-01-31" });

    expect(rpcMock).toHaveBeenCalledWith("rpc_acoes_negocios_perdidos", {
      p_from: "2026-01-01",
      p_to: "2026-01-31",
      p_funis: null,
    });
  });

  it("normalizes an explicitly empty funnel selection to null", async () => {
    await fetchAcoesNegociosPerdidos({ funis: [] });

    expect(rpcMock).toHaveBeenCalledWith("rpc_acoes_negocios_perdidos", {
      p_funis: null,
    });
  });

  it("sends the selected funnel array without changing its values", async () => {
    await fetchAcoesNegociosPerdidos({
      cidade: "Curitiba",
      funis: ["ADM", "BANCOS"],
    });

    expect(rpcMock).toHaveBeenCalledWith("rpc_acoes_negocios_perdidos", {
      p_cidade: "Curitiba",
      p_funis: ["ADM", "BANCOS"],
    });
  });
});
