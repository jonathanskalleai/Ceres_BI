import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePainelKPIsRpc, type PainelKPIs } from "@/hooks/bi/usePainelKPIsRpc";
import { fetchPainelKPIs } from "@/services/bi/painelService";

vi.mock("@/services/bi/painelService", () => ({
  fetchPainelKPIs: vi.fn(),
}));

const kpi = { value: 10, previousValue: 8, trend: "up" as const };
const panel: PainelKPIs = {
  totalNegocios: kpi,
  ganhos: kpi,
  perdidos: kpi,
  andamento: kpi,
  taxaConversao: kpi,
  valorGanho: kpi,
  valorPerdido: kpi,
  pipelineAberto: kpi,
  ticketMedio: kpi,
  totalAcoes: kpi,
  totalVisitas: kpi,
  totalOS: kpi,
  porTipoAcao: [],
  oportunidadesAbertas: kpi,
  visitasPorOportunidade: kpi,
  diasParados: kpi,
  negociosOutrosStatus: 0,
  ignoresFunilFilter: {},
  dataQuality: { status: "ready", missing: [] },
};

describe("usePainelKPIsRpc", () => {
  afterEach(() => vi.clearAllMocks());

  it("loads one server-composed panel contract with all filters", async () => {
    vi.mocked(fetchPainelKPIs).mockResolvedValue(panel);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => usePainelKPIsRpc(
        { from: new Date(2026, 0, 1), to: new Date(2026, 8, 20) },
        "Vendas Maquinas",
        "__all__",
        "vend-1",
        "São Paulo",
      ),
      { wrapper },
    );

    await waitFor(() => expect(result.current.comparisonReady).toBe(true));
    expect(result.current.kpis.ticketMedio.value).toBe(10);
    expect(vi.mocked(fetchPainelKPIs)).toHaveBeenCalledWith({
      from: "2026-01-01",
      to: "2026-09-20",
      funis: ["VENDAS", "ADM", "BANCOS", "OFICINA", "MARKETING"],
      vendedor: "vend-1",
      cidade: "São Paulo",
    });
  });
});
