import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock, logErrorMock, logWarningMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  logErrorMock: vi.fn(),
  logWarningMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: rpcMock } }));
vi.mock("@/lib/logger", () => ({ logClientError: logErrorMock, logClientWarning: logWarningMock }));

import {
  fetchAcoesDetalheRuntime,
  fetchAcoesMapaRuntime,
  fetchAcoesRuntime,
} from "@/services/bi/acoesRuntimeService";

function acoesPayload() {
  return {
    kpis: {
      totalAcoes: 0, cidades: 0, consultores: 0, visitas: 0, clientes: 0, tiposAcaoDistintos: 0,
      valorGanho: 0, negociosGanho: 0, valorPerdido: 0, negociosPerdido: 0,
      negociosOutrosStatus: 0, tempoMedioContato: 0,
    },
    porVendedor: [], porCidade: [], porMes: [], porDiaSemana: [], porTipoAcao: [], porTipoContato: [],
    listaAnos: [], porVendedorCidade: [], clientesMaisAtendidos: [],
  };
}

beforeEach(() => {
  rpcMock.mockReset();
  logErrorMock.mockReset();
  logWarningMock.mockReset();
});
describe("acoesRuntimeService", () => {
  it("passes React Query's AbortSignal to the PostgREST builder", async () => {
    const signal = new AbortController().signal;
    const abortSignal = vi.fn().mockResolvedValue({ data: [acoesPayload()], error: null });
    rpcMock.mockReturnValue({ abortSignal });

    await expect(fetchAcoesRuntime({ signal })).resolves.toMatchObject({ kpis: { totalAcoes: 0 } });
    expect(abortSignal).toHaveBeenCalledWith(signal);
  });

  it("accepts wrapped payloads but rejects NaN instead of defaulting to zero", async () => {
    rpcMock.mockResolvedValue({ data: [acoesPayload()], error: null });
    await expect(fetchAcoesRuntime({})).resolves.toMatchObject({ kpis: { clientes: 0 } });

    const malformed = acoesPayload();
    malformed.kpis.clientes = Number.NaN;
    rpcMock.mockResolvedValue({ data: malformed, error: null });
    await expect(fetchAcoesRuntime({})).rejects.toMatchObject({ name: "BiContractError", code: "BI_CONTRACT_NUMBER" });
    expect(logErrorMock).toHaveBeenCalled();
  });

  it("keeps null detail values but rejects a missing rows contract", async () => {
    rpcMock.mockResolvedValue({ data: { rows: [{ valor: null }], total: 1 }, error: null });
    await expect(fetchAcoesDetalheRuntime({})).resolves.toMatchObject({ total: 1 });

    rpcMock.mockResolvedValue({ data: { total: 1 }, error: null });
    await expect(fetchAcoesDetalheRuntime({})).rejects.toMatchObject({ name: "BiContractError" });
  });

  it("discards malformed map pins without making Leaflet receive invalid coordinates", async () => {
    rpcMock.mockResolvedValue({
      data: {
        pinos: [
          { lat: -27.1, lon: -52.6, valor: 0 },
          { lat: Number.NaN, lon: -52.6, valor: 0 },
        ],
        total: 2, comCoordenada: 1, semCoordenada: 1, valorTotal: 0, valorNoMapa: 0,
        meta: { viaAcao: 0, viaCarteira: 1, abertos: 1, ganhos: 0, perdidos: 0 },
      },
      error: null,
    });
    const result = await fetchAcoesMapaRuntime({});
    expect(result.pinos).toHaveLength(1);
    expect(logWarningMock).toHaveBeenCalled();
  });
});
