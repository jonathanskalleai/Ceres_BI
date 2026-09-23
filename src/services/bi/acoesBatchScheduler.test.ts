import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchBiApiMock } = vi.hoisted(() => ({ fetchBiApiMock: vi.fn() }));

vi.mock("@/services/bi/biApiTransport", () => ({ fetchBiApi: fetchBiApiMock }));

import {
  fetchAcoesBatchBlock,
  resetAcoesBatchScheduler,
} from "@/services/bi/acoesBatchScheduler";

const params = { from: "2026-01-01", to: "2026-01-31", cidade: "São Paulo" };

beforeEach(() => {
  fetchBiApiMock.mockReset();
});

afterEach(() => {
  resetAcoesBatchScheduler();
});

describe("acoesBatchScheduler", () => {
  it("coalesces core and funil calls with the same filters into one batch", async () => {
    fetchBiApiMock.mockResolvedValue({ core: { kpis: { totalAcoes: 4 } }, funil: { funil: { visitas: 2 } } });

    const [core, funil] = await Promise.all([
      fetchAcoesBatchBlock("core", params),
      fetchAcoesBatchBlock("funil", params),
    ]);

    expect(core).toEqual({ kpis: { totalAcoes: 4 } });
    expect(funil).toEqual({ funil: { visitas: 2 } });
    expect(fetchBiApiMock).toHaveBeenCalledTimes(1);
    expect(fetchBiApiMock).toHaveBeenCalledWith("/acoes/batch", params, expect.any(AbortSignal));
  });

  it("uses the individual endpoint when only one block is requested", async () => {
    fetchBiApiMock.mockResolvedValue({ kpis: { totalAcoes: 4 } });

    await expect(fetchAcoesBatchBlock("core", params)).resolves.toEqual({ kpis: { totalAcoes: 4 } });

    expect(fetchBiApiMock).toHaveBeenCalledTimes(1);
    expect(fetchBiApiMock).toHaveBeenCalledWith("/acoes/core", params, expect.any(AbortSignal));
  });

  it("keeps AbortSignal out of the filter query", async () => {
    fetchBiApiMock.mockResolvedValue({ core: { kpis: { totalAcoes: 4 } } });
    const signal = new AbortController().signal;

    await fetchAcoesBatchBlock("core", { ...params, signal } as typeof params & { signal: AbortSignal });

    expect(fetchBiApiMock.mock.calls[0][1]).toEqual(params);
  });

  it("fails only the missing block instead of substituting zeros", async () => {
    fetchBiApiMock.mockResolvedValue({ core: { kpis: { totalAcoes: 4 } } });

    const funil = fetchAcoesBatchBlock("funil", params);
    const core = fetchAcoesBatchBlock("core", params);
    await expect(funil).rejects.toMatchObject({
      name: "BiContractError",
      code: "BI_CONTRACT_MISSING",
    });
    await expect(core).resolves.toEqual({ kpis: { totalAcoes: 4 } });
  });

  it("cancels an individual subscriber without cancelling another block", async () => {
    fetchBiApiMock.mockResolvedValue({ funil: { visitas: 2 } });
    const controller = new AbortController();
    const core = fetchAcoesBatchBlock("core", params, controller.signal);
    const funil = fetchAcoesBatchBlock("funil", params);
    controller.abort();

    await expect(core).rejects.toMatchObject({ name: "AbortError" });
    await expect(funil).resolves.toEqual({ funil: { visitas: 2 } });
    expect(fetchBiApiMock).toHaveBeenCalledTimes(1);
  });
});
