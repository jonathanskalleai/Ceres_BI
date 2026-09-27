import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: rpcMock },
}));

import { EMPTY_DESEMPENHO_DATA, fetchDesempenhoVendas } from "@/services/bi/desempenhoVendasService";

describe("fetchDesempenhoVendas RPC contract", () => {
  beforeEach(() => {
    rpcMock.mockReset().mockResolvedValue({ data: EMPTY_DESEMPENHO_DATA, error: null });
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

  it("rejects a missing payload instead of rendering an all-zero dashboard", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });

    await expect(fetchDesempenhoVendas()).rejects.toMatchObject({
      name: "BiContractError",
      code: "BI_CONTRACT_MISSING",
    });
  });

  it("rejects a KPI block with a missing field instead of filling it with zero", async () => {
    rpcMock.mockResolvedValueOnce({ data: { kpis: { faturamento: 10 } }, error: null });

    await expect(fetchDesempenhoVendas({ ano: 2026 })).rejects.toMatchObject({
      name: "BiContractError",
      code: "BI_CONTRACT_INVALID",
    });
  });

  it("requires the server-computed conversion KPI", async () => {
    const { taxaConversao: _taxaConversao, ...kpisWithoutConversion } = EMPTY_DESEMPENHO_DATA.kpis;
    rpcMock.mockResolvedValueOnce({
      data: { ...EMPTY_DESEMPENHO_DATA, kpis: kpisWithoutConversion },
      error: null,
    });

    await expect(fetchDesempenhoVendas()).rejects.toMatchObject({
      name: "BiContractError",
      code: "BI_CONTRACT_INVALID",
    });
  });

  it("rejects non-finite values before they reach a chart formatter", async () => {
    const malformed = {
      ...EMPTY_DESEMPENHO_DATA,
      kpis: { ...EMPTY_DESEMPENHO_DATA.kpis, faturamento: Number.NaN },
    };
    rpcMock.mockResolvedValueOnce({ data: malformed, error: null });

    await expect(fetchDesempenhoVendas()).rejects.toMatchObject({
      name: "BiContractError",
      code: "BI_CONTRACT_NUMBER",
    });
  });

  it("rejects null or string KPIs instead of coercing them to zero", async () => {
    const malformed = {
      ...EMPTY_DESEMPENHO_DATA,
      kpis: { ...EMPTY_DESEMPENHO_DATA.kpis, ticketMedio: null },
    };
    rpcMock.mockResolvedValueOnce({ data: malformed, error: null });

    await expect(fetchDesempenhoVendas()).rejects.toMatchObject({
      name: "BiContractError",
      code: "BI_CONTRACT_NUMBER",
    });
  });
});
