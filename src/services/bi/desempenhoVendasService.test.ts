import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: rpcMock },
}));

import { fetchDesempenhoVendas } from "@/services/bi/desempenhoVendasService";

describe("fetchDesempenhoVendas RPC contract", () => {
  beforeEach(() => {
    rpcMock.mockReset().mockResolvedValue({ data: {}, error: null });
  });

  it("sends p_funis explicitly as null when no funnel filter is active", async () => {
    await fetchDesempenhoVendas();

    expect(rpcMock).toHaveBeenCalledWith("rpc_desempenho_vendas_bi", {
      p_funis: null,
    });
  });

  it("sends the selected funnel array without changing its values", async () => {
    await fetchDesempenhoVendas({
      ano: 2026,
      funis: ["Venda Direta", "Parcerias"],
    });

    expect(rpcMock).toHaveBeenCalledWith("rpc_desempenho_vendas_bi", {
      p_ano: 2026,
      p_funis: ["Venda Direta", "Parcerias"],
    });
  });

  it("normalizes an explicitly empty funnel selection to null", async () => {
    await fetchDesempenhoVendas({ funis: [] });

    expect(rpcMock).toHaveBeenCalledWith("rpc_desempenho_vendas_bi", {
      p_funis: null,
    });
  });
});
